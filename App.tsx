import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ComponentProps, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';

type TabKey = 'home' | 'battleground' | 'records' | 'goals';
type IconName = ComponentProps<typeof Ionicons>['name'];
type HealthLog = { steps: number; calories: number; water: number; sleep: number; mood: number; stress: number };
type ThemeMode = 'light' | 'dark';
type Theme = ReturnType<typeof getTheme>;
type AppStyles = ReturnType<typeof createStyles>;
type Exercise = { id: string; name: string; weight: number; unit: 'kg' | 'lbs'; sets: number; reps: number };
type WorkoutSession = { id: string; date: string; day: string; splitType: string; muscleGroup: string; exercises: Exercise[]; vitals: HealthLog };
type UserGoal = { id: string; name: string; target: number; unit: string };
type UserProfile = { name: string; plan: string };
type StoredAppData = { log: HealthLog; sessions: WorkoutSession[]; userGoals: UserGoal[]; profile: UserProfile; mode: ThemeMode };

const tabs: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'home', label: 'Home', icon: 'pulse-outline' },
  { key: 'battleground', label: 'Battleground', icon: 'flame-outline' },
  { key: 'records', label: 'Records', icon: 'trophy-outline' },
  { key: 'goals', label: 'Goals', icon: 'flag-outline' },
];

const STORAGE_KEY = 'harbinger-user-data-v1';
const baseLog: HealthLog = { steps: 0, calories: 0, water: 0, sleep: 0, mood: 0, stress: 0 };
const baseProfile: UserProfile = { name: 'Your Profile', plan: 'Local data only' };

const METRICS: Array<{ key: keyof HealthLog; label: string; icon: IconName; unit: string; target: number; color: string }> = [
  { key: 'steps', label: 'Steps', icon: 'trending-up-outline', unit: 'steps', target: 10000, color: '#FF6600' },
  { key: 'calories', label: 'Calories', icon: 'thunderstorm-outline', unit: 'kcal', target: 650, color: '#FF8C00' },
  { key: 'water', label: 'Water', icon: 'umbrella-outline', unit: 'L', target: 3, color: '#FFAA33' },
  { key: 'sleep', label: 'Sleep', icon: 'moon-outline', unit: 'hrs', target: 8, color: '#E67E22' },
  { key: 'mood', label: 'Mood', icon: 'sunny-outline', unit: '/10', target: 10, color: '#FFB347' },
  { key: 'stress', label: 'Stress', icon: 'heart-outline', unit: '/10', target: 10, color: '#FF4500' },
];

const fitnessQuotes = [
  "Your only opponent is the person you were yesterday.",
  "The pain you feel today is the strength you feel tomorrow.",
  "It never gets easier. You just get stronger.",
  "You didn't come this far to only come this far.",
  "The body achieves what the mind believes.",
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BRO_SPLIT = ['Chest', 'Back', 'Bicep', 'Tricep', 'Legs', 'Shoulders', 'Abs'];
const PPL_SPLIT = ['Chest & Tri', 'Back & Bic', 'Legs', 'Shoulders & Abs'];

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 650, fade: true });

export default function App() {
  const [tab, setTab] = useState<TabKey>('home');
  const [mode, setMode] = useState<ThemeMode>('light');
  const [profile, setProfile] = useState(false);
  const [log, setLog] = useState<HealthLog>(baseLog);
  const [editKey, setEditKey] = useState<keyof HealthLog | null>(null);
  const [editVal, setEditVal] = useState('');
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [userGoals, setUserGoals] = useState<UserGoal[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(baseProfile);
  const [storageReady, setStorageReady] = useState(false);
  const [onboardingName, setOnboardingName] = useState('');
  const { width } = useWindowDimensions();

  const theme = useMemo(() => getTheme(mode), [mode]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isWide = width >= 720;
  const score = useMemo(() => calcScore(log), [log]);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        const data = JSON.parse(raw) as Partial<StoredAppData>;
        if (data.log) setLog({ ...baseLog, ...data.log });
        if (Array.isArray(data.sessions)) setSessions(data.sessions);
        if (Array.isArray(data.userGoals)) setUserGoals(data.userGoals);
        if (data.profile) setUserProfile({ ...baseProfile, ...data.profile });
        if (data.mode === 'light' || data.mode === 'dark') setMode(data.mode);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setStorageReady(true);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const data: StoredAppData = { log, sessions, userGoals, profile: userProfile, mode };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => undefined);
  }, [log, sessions, userGoals, userProfile, mode, storageReady]);

  useEffect(() => {
    if (storageReady) SplashScreen.hideAsync().catch(() => undefined);
  }, [storageReady]);

  const startEdit = (k: keyof HealthLog) => { setEditKey(k); setEditVal(String(log[k])); };
  const saveEdit = () => {
    if (!editKey) return;
    const p = Number(editVal.replace(/,/g, '').trim());
    if (Number.isFinite(p) && p >= 0) setLog((prev) => ({ ...prev, [editKey]: p }));
    setEditKey(null); setEditVal('');
  };
  const adjust = (k: keyof HealthLog, d: number) => {
    setLog((prev) => {
      const raw = prev[k] + d;
      if (k === 'mood' || k === 'stress') return { ...prev, [k]: Math.max(0, Math.min(10, Math.round(raw))) };
      if (k === 'water' || k === 'sleep') return { ...prev, [k]: Math.max(0, Math.round(raw * 10) / 10) };
      return { ...prev, [k]: Math.max(0, Math.round(raw)) };
    });
  };
  const addSession = (s: Omit<WorkoutSession, 'id' | 'vitals'>) => {
    setSessions((prev) => [...prev, { ...s, vitals: { ...log }, id: Date.now().toString() }]);
  };
  const deleteSession = (id: string) => setSessions((prev) => prev.filter((s) => s.id !== id));
  const addGoal = (g: Omit<UserGoal, 'id'>) => setUserGoals((prev) => [...prev, { ...g, id: Date.now().toString() }]);
  const deleteGoal = (id: string) => setUserGoals((prev) => prev.filter((g) => g.id !== id));
  const resetData = () => {
    setLog(baseLog);
    setSessions([]);
    setUserGoals([]);
  };

  const finishOnboarding = () => {
    const name = onboardingName.trim();
    if (!name) return;
    setUserProfile({ name, plan: 'Local data only' });
  };

  if (!storageReady) return null;

  if (!userProfile.name.trim() || userProfile.name === baseProfile.name) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <StatusBar style={mode === 'dark' ? 'light' : 'dark'} backgroundColor={theme.bg} />
          <Onboarding
            name={onboardingName}
            onNameChange={setOnboardingName}
            onContinue={finishOnboarding}
            styles={styles}
            theme={theme}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} backgroundColor={theme.bg} />
        <View style={styles.shell}>
          <TopBar mode={mode} onMode={() => setMode(mode === 'dark' ? 'light' : 'dark')} onProfile={() => setProfile(true)} styles={styles} theme={theme} />
          <View style={[styles.content, isWide && styles.contentWide]}>
            {tab === 'home' && <Home log={log} score={score} editKey={editKey} editVal={editVal}
              onStartEdit={startEdit} onSaveEdit={saveEdit} onEditChange={setEditVal} onAdjust={adjust}
              styles={styles} theme={theme} />}
            {tab === 'battleground' && <Battleground onAddSession={addSession} styles={styles} theme={theme} />}
            {tab === 'records' && <Records sessions={sessions} log={log} onDeleteSession={deleteSession} styles={styles} theme={theme} />}
            {tab === 'goals' && <Goals log={log} sessions={sessions} userGoals={userGoals} onAddGoal={addGoal} onDeleteGoal={deleteGoal} styles={styles} theme={theme} />}
          </View>
          <Nav active={tab} onTab={setTab} styles={styles} theme={theme} />
          {profile && <ProfilePanel log={log} score={score} mode={mode} profile={userProfile}
            onProfileChange={setUserProfile} onResetData={resetData}
            onClose={() => setProfile(false)} onMode={() => setMode(mode === 'dark' ? 'light' : 'dark')}
            styles={styles} theme={theme} />}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function TopBar({ mode, onMode, onProfile, styles, theme }: {
  mode: ThemeMode; onMode: () => void; onProfile: () => void; styles: AppStyles; theme: Theme;
}) {
  return (
    <View style={styles.topBar}>
      <View style={styles.brandRow}>
        <Image source={require('./assets/logo.png')} style={{ width: 36, height: 36, borderRadius: 10 }} />
        <View>
          <Text style={styles.brandName}>Harbinger</Text>
          <Text style={styles.brandSub}>Health Copilot</Text>
        </View>
      </View>
      <View style={styles.topActions}>
        <Pressable onPress={onMode} style={styles.topBtn}><Ionicons name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={18} color={theme.ink} /></Pressable>
        <Pressable onPress={onProfile} style={styles.topBtn}><Ionicons name="person-outline" size={18} color={theme.ink} /></Pressable>
      </View>
    </View>
  );
}

function ScreenScroll({ children, styles }: { children: ReactNode; styles: AppStyles }) {
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>{children}</ScrollView>;
}

function Onboarding({ name, onNameChange, onContinue, styles, theme }: {
  name: string; onNameChange: (name: string) => void; onContinue: () => void; styles: AppStyles; theme: Theme;
}) {
  const canContinue = name.trim().length > 0;
  return (
    <View style={styles.onboardingScreen}>
      <LinearGradient colors={theme.heroGrad} style={styles.onboardingCard}>
        <Image source={require('./assets/logo.png')} style={styles.onboardingLogo} />
        <Text style={styles.onboardingTitle}>Harbinger</Text>
        <Text style={styles.onboardingSubtitle}>Your data stays on this device.</Text>
        <TextInput
          value={name}
          onChangeText={onNameChange}
          placeholder="Enter your name"
          placeholderTextColor={theme.muted}
          autoFocus
          style={styles.onboardingInput}
          returnKeyType="done"
          onSubmitEditing={onContinue}
        />
        <Pressable onPress={onContinue} disabled={!canContinue} style={[styles.onboardingButton, !canContinue && styles.onboardingButtonDisabled]}>
          <Text style={styles.onboardingButtonText}>Start</Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

function Home({ log, score, editKey, editVal, onStartEdit, onSaveEdit, onEditChange, onAdjust, styles, theme }: {
  log: HealthLog; score: number; editKey: keyof HealthLog | null; editVal: string;
  onStartEdit: (k: keyof HealthLog) => void; onSaveEdit: () => void; onEditChange: (v: string) => void;
  onAdjust: (k: keyof HealthLog, d: number) => void; styles: AppStyles; theme: Theme;
}) {
  const [quoteIdx] = useState(() => Math.floor(Math.random() * fitnessQuotes.length));
  const predictions = getPredictions(log);
  const predColors = ['#FF6600', '#FF8C00', '#FFAA33', '#FF4500'];

  return (
    <ScreenScroll styles={styles}>
      <LinearGradient colors={theme.heroGrad} style={styles.hero}>
        <View style={styles.heroContent}>
          <Text style={styles.heroKicker}>WELCOME TO BATTLE GROUND</Text>
          <Text style={styles.heroQuote}>"{fitnessQuotes[quoteIdx]}"</Text>
          <Text style={styles.heroBody}>{score} score · {fmt(log.steps)} steps · {log.calories} kcal today</Text>
          <View style={styles.orbWrap}><CrossfitLottie /></View>
        </View>
      </LinearGradient>
      <Text style={styles.sectionTitle}>Vitals</Text>
      <View style={styles.metricGrid}>
        {METRICS.map((m) => {
          const val = log[m.key];
          const progress = m.key === 'stress' ? 1 - Math.min(val / m.target, 1) : Math.min(val / m.target, 1);
          const display = m.key === 'steps' || m.key === 'calories' ? fmt(val) : String(val);
          const step = m.key === 'water' || m.key === 'sleep' ? 0.5 : 1;
          return (
            <View key={m.key} style={styles.metricCard}>
              <View style={[styles.metricIconWrap, { backgroundColor: `${m.color}20` }]}><Ionicons name={m.icon} size={20} color={m.color} /></View>
              <Text style={styles.metricLabel}>{m.label}</Text>
              {editKey === m.key ? (
                <View style={styles.editRow}>
                  <TextInput keyboardType="decimal-pad" onChangeText={onEditChange} value={editVal} style={styles.editInput} autoFocus onBlur={onSaveEdit} />
                  <Pressable onPress={onSaveEdit} style={styles.editBtn}><Ionicons name="checkmark" size={16} color="#fff" /></Pressable>
                </View>
              ) : (
                <Pressable onPress={() => onStartEdit(m.key)} style={styles.valRow}>
                  <Text style={styles.metricVal}>{display}</Text>
                  <Text style={styles.metricUnit}>{m.unit}</Text>
                </Pressable>
              )}
              <View style={styles.track}><View style={[styles.trackFill, { width: `${progress * 100}%`, backgroundColor: m.color }]} /></View>
              <View style={styles.adjRow}>
                <Pressable onPress={() => onAdjust(m.key, -step)} style={styles.adjBtn}><Ionicons name="remove" size={14} color="#666" /></Pressable>
                <Pressable onPress={() => onAdjust(m.key, step)} style={styles.adjBtn}><Ionicons name="add" size={14} color="#666" /></Pressable>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={styles.sectionTitle}>Predictions</Text>
      <View style={styles.predGrid}>
        {predictions.map((p, i) => (
          <View key={p.title} style={[styles.predCard, { backgroundColor: `${predColors[i]}12` }]}>
            <View style={[styles.predIcon, { backgroundColor: predColors[i] }]}><Ionicons name={p.icon as IconName} size={18} color="#fff" /></View>
            <Text style={[styles.predTitle, { color: predColors[i] }]}>{p.title}</Text>
            <Text style={styles.predVal}>{p.value}</Text>
            <Text style={styles.predTrend}>{p.trend}</Text>
          </View>
        ))}
      </View>
      <LinearGradient colors={['#FF6600', '#FF8C00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionCard}>
        <Ionicons name="bulb-outline" size={24} color="#fff" />
        <View style={styles.actionBody}>
          <Text style={styles.actionLbl}>Top Action</Text>
          <Text style={styles.actionTxt}>{getTopAction(log)}</Text>
        </View>
      </LinearGradient>
    </ScreenScroll>
  );
}

function CrossfitLottie() {
  return <LottieView source={require('./assets/lottie/Crossfit animation.json')} autoPlay loop style={{ width: 250, height: 250 }} speed={0.7} />;
}

function BattleImage() {
  return (
    <View style={{ width: '100%', maxWidth: 300, aspectRatio: 1, borderRadius: 30, overflow: 'hidden', backgroundColor: '#FF660020', alignSelf: 'center' }}>
      <Image source={require('./assets/Gemini_Generated_Image_tgmw5btgmw5btgmw.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
    </View>
  );
}

function Battleground({ onAddSession, styles, theme }: {
  onAddSession: (s: Omit<WorkoutSession, 'id' | 'vitals'>) => void; styles: AppStyles; theme: Theme;
}) {
  const [splitType, setSplitType] = useState<'bro' | 'ppl' | 'custom'>('bro');
  const [day, setDay] = useState(() => DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [muscleGroup, setMuscleGroup] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exName, setExName] = useState('');
  const [exWeight, setExWeight] = useState('');
  const [exUnit, setExUnit] = useState<'kg' | 'lbs'>('kg');
  const [exSets, setExSets] = useState('');
  const [exReps, setExReps] = useState('');

  const groupOpts = splitType === 'bro' ? BRO_SPLIT : PPL_SPLIT;

  const addExercise = () => {
    const w = Number(exWeight);
    const s = Number(exSets);
    const r = Number(exReps);
    if (!exName || !Number.isFinite(w) || w <= 0 || !Number.isFinite(s) || s <= 0 || !Number.isFinite(r) || r <= 0) return;
    setExercises((prev) => [...prev, { id: Date.now().toString() + Math.random(), name: exName, weight: w, unit: exUnit, sets: Math.round(s), reps: Math.round(r) }]);
    setExName(''); setExWeight(''); setExSets(''); setExReps('');
  };

  const saveSession = () => {
    const mg = splitType === 'custom' ? muscleGroup.trim() : muscleGroup;
    if (!mg || exercises.length === 0) return;
    onAddSession({ date, day, splitType, muscleGroup: mg, exercises });
    setExercises([]); setMuscleGroup(''); setExName(''); setExWeight(''); setExSets(''); setExReps('');
  };

  return (
    <ScreenScroll styles={styles}>
      <LinearGradient colors={theme.heroGrad} style={styles.hero}>
        <View style={styles.heroContent}>
          <Text style={styles.heroKicker}>BATTLE GROUND</Text>
          <Text style={styles.heroTitle}>Training Log</Text>
          <Text style={styles.heroBody}>Log your lifts and track your progress.</Text>
          <View style={styles.orbWrap}><BattleImage /></View>
        </View>
      </LinearGradient>

      <Text style={styles.sectionTitle}>Log Workout</Text>
      <View style={styles.form}>
        <View style={styles.splitRow}>
          <Pressable onPress={() => { setSplitType('bro'); setDropdownOpen(false); setMuscleGroup(''); }} style={[styles.splitBtn, splitType === 'bro' && styles.splitBtnActive]}><Text style={[styles.splitBtnText, splitType === 'bro' && styles.splitBtnTextActive]}>Bro Split</Text></Pressable>
          <Pressable onPress={() => { setSplitType('ppl'); setDropdownOpen(false); setMuscleGroup(''); }} style={[styles.splitBtn, splitType === 'ppl' && styles.splitBtnActive]}><Text style={[styles.splitBtnText, splitType === 'ppl' && styles.splitBtnTextActive]}>PPL</Text></Pressable>
          <Pressable onPress={() => { setSplitType('custom'); setDropdownOpen(false); setMuscleGroup(''); }} style={[styles.splitBtn, splitType === 'custom' && styles.splitBtnActive]}><Text style={[styles.splitBtnText, splitType === 'custom' && styles.splitBtnTextActive]}>Custom</Text></Pressable>
        </View>

        <View style={styles.dayRow}>
          {DAYS.map((d) => (
            <Pressable key={d} onPress={() => setDay(d)} style={[styles.dayBtn, day === d && styles.dayBtnActive]}>
              <Text style={[styles.dayBtnText, day === d && styles.dayBtnTextActive]}>{d}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput placeholder="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} style={styles.input} placeholderTextColor={theme.muted} />

        {splitType === 'custom' ? (
          <TextInput placeholder="Muscle group (e.g. Full Body)" value={muscleGroup} onChangeText={setMuscleGroup} style={styles.input} placeholderTextColor={theme.muted} />
        ) : (
          <>
            <View style={{ position: 'relative', zIndex: 10 }}>
              <Pressable onPress={() => setDropdownOpen(!dropdownOpen)} style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: muscleGroup ? theme.ink : theme.muted }}>{muscleGroup || 'Select muscle group'}</Text>
                <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.muted} />
              </Pressable>
              {dropdownOpen && (
                <View style={{ position: 'absolute', top: 52, left: 0, right: 0, backgroundColor: theme.paper, borderRadius: 16, borderWidth: 1, borderColor: theme.line, maxHeight: 260, ...Platform.select({ web: { boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }, default: {} }) }}>
                  <ScrollView>
                    {groupOpts.map((g) => (
                      <Pressable key={g} onPress={() => { setMuscleGroup(g); setDropdownOpen(false); }} style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.line, backgroundColor: muscleGroup === g ? '#FF660010' : 'transparent' }}>
                        <Text style={{ fontSize: 15, fontWeight: muscleGroup === g ? '800' : '600', color: muscleGroup === g ? theme.primary : theme.ink }}>{g}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
            <TextInput
              placeholder="Or type your own muscle group"
              value={groupOpts.includes(muscleGroup) ? '' : muscleGroup}
              onChangeText={(value) => { setMuscleGroup(value); setDropdownOpen(false); }}
              style={styles.input}
              placeholderTextColor={theme.muted}
            />
          </>
        )}

        {muscleGroup ? (
          <View style={styles.selectedWorkoutCard}>
            <Text style={styles.selectedWorkoutLabel}>Workout</Text>
            <Text style={styles.selectedWorkoutName}>{muscleGroup}</Text>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { fontSize: 14, marginTop: 4, marginBottom: 4 }]}>Exercises</Text>
        {exercises.length > 0 && exercises.map((e, i) => (
          <View key={i} style={[styles.workoutRow, { marginBottom: 4 }]}>
            <View style={styles.workoutBody}>
              <Text style={styles.workoutName}>{e.name}</Text>
              <Text style={styles.workoutDetail}>{e.weight} {e.unit} - {e.sets} x {e.reps}</Text>
            </View>
            <Pressable onPress={() => setExercises((prev) => prev.filter((_, idx) => idx !== i))}><Ionicons name="close-circle" size={20} color="#ef4444" /></Pressable>
          </View>
        ))}

        <TextInput placeholder="Exercise name" value={exName} onChangeText={setExName} style={styles.input} placeholderTextColor={theme.muted} />
        <View style={styles.formRow}>
          <TextInput placeholder="Weight" value={exWeight} onChangeText={setExWeight} keyboardType="decimal-pad" style={[styles.input, { flex: 1 }]} placeholderTextColor={theme.muted} />
          <View style={styles.unitRow}>
            <Pressable onPress={() => setExUnit('kg')} style={[styles.unitBtn, exUnit === 'kg' && styles.unitBtnActive]}><Text style={[styles.unitBtnText, exUnit === 'kg' && styles.unitBtnTextActive]}>kg</Text></Pressable>
            <Pressable onPress={() => setExUnit('lbs')} style={[styles.unitBtn, exUnit === 'lbs' && styles.unitBtnActive]}><Text style={[styles.unitBtnText, exUnit === 'lbs' && styles.unitBtnTextActive]}>lbs</Text></Pressable>
          </View>
        </View>
        <TextInput placeholder="Sets" value={exSets} onChangeText={setExSets} keyboardType="number-pad" style={styles.input} placeholderTextColor={theme.muted} />
        <TextInput placeholder="Reps" value={exReps} onChangeText={setExReps} keyboardType="number-pad" style={styles.input} placeholderTextColor={theme.muted} />
        <Pressable onPress={addExercise} style={{ backgroundColor: theme.primary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}><Ionicons name="add" size={20} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Add Exercise</Text></Pressable>

        <Pressable onPress={saveSession} style={styles.submitBtn}><Text style={styles.submitBtnText}>Save Workout ({exercises.length} exercises)</Text></Pressable>
      </View>
    </ScreenScroll>
  );
}

function Records({ sessions, log, onDeleteSession, styles, theme }: {
  sessions: WorkoutSession[]; log: HealthLog; onDeleteSession: (id: string) => void; styles: AppStyles; theme: Theme;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState('All');

  const getPR = (exName: string): { weight: number; date: string } | null => {
    let maxW = 0; let bestDate = '';
    for (const s of sessions) {
      for (const e of s.exercises) {
        if (e.name.toLowerCase() === exName.toLowerCase() && e.weight > maxW) {
          maxW = e.weight; bestDate = s.date;
        }
      }
    }
    return maxW > 0 ? { weight: maxW, date: bestDate } : null;
  };

  const grouped = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>();
    const visibleSessions = selectedGroup === 'All' ? sessions : sessions.filter((s) => s.muscleGroup === selectedGroup);
    for (const s of visibleSessions) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sessions, selectedGroup]);

  const groups = useMemo(() => ['All', ...Array.from(new Set(sessions.map((s) => s.muscleGroup)))], [sessions]);

  return (
    <ScreenScroll styles={styles}>
      <LinearGradient colors={theme.heroGrad} style={styles.hero}>
        <View style={styles.heroContent}>
          <Text style={styles.heroKicker}>Workout Records</Text>
          <Text style={styles.heroTitle}>Your training history</Text>
          <Text style={styles.heroBody}>Track all your workouts, exercises, and personal records.</Text>
        </View>
      </LinearGradient>

      <Text style={styles.sectionTitle}>Today Vitals</Text>
      <VitalsGrid log={log} styles={styles} />

      {groups.length > 1 && (
        <>
          <Text style={styles.sectionTitle}>Workout</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {groups.map((g) => (
              <Pressable key={g} onPress={() => { setSelectedGroup(g); setExpanded(null); }} style={[styles.filterChip, selectedGroup === g && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, selectedGroup === g && styles.filterChipTextActive]}>{g}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {sessions.length === 0 && (
        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.muted, textAlign: 'center', marginVertical: 40 }}>No workouts logged yet. Start in Battleground!</Text>
      )}

      {grouped.map(([d, daySessions]) => (
        <View key={d} style={{ marginBottom: 16 }}>
          <Text style={styles.dateHeader}>{fmtDate(d)} - {daySessions[0].day}</Text>
          <VitalsGrid log={daySessions[0].vitals || log} styles={styles} compact />
          {daySessions.map((s) => (
            <View key={s.id} style={[styles.recordCard, { marginBottom: 8 }]}>
              <Pressable onPress={() => setExpanded(expanded === s.id ? null : s.id)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.recordIconWrap, { marginBottom: 0 }]}><Ionicons name="barbell-outline" size={18} color="#FF6600" /></View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: theme.ink }}>{s.muscleGroup}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted }}>{s.exercises.length} exercises</Text>
                  <Ionicons name={expanded === s.id ? 'chevron-up' : 'chevron-down'} size={16} color={theme.muted} />
                </View>
              </Pressable>
              {expanded === s.id && (
                <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: theme.line, paddingTop: 10 }}>
                  {s.exercises.map((e, i) => {
                    const pr = getPR(e.name);
                    const isPR = pr && pr.weight === e.weight && pr.date === s.date;
                    return (
                      <View key={i} style={[styles.recordExerciseRow, { borderBottomWidth: i < s.exercises.length - 1 ? 1 : 0, borderBottomColor: theme.line }]}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.recordExerciseName} numberOfLines={2}>{e.name}</Text>
                            {isPR && <View style={{ backgroundColor: '#22c55e20', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 10, fontWeight: '800', color: '#22c55e' }}>PR</Text></View>}
                          </View>
                          <Text style={styles.recordExerciseDetail}>{e.weight} {e.unit} - {e.sets} sets x {e.reps} reps</Text>
                        </View>
                        {pr && !isPR && <Text style={styles.recordPrText}>PR: {pr.weight} {e.unit}</Text>}
                      </View>
                    );
                  })}
                  <Pressable onPress={() => onDeleteSession(s.id)} style={styles.deleteRecordBtn}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    <Text style={styles.deleteRecordText}>Delete workout</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>
      ))}
    </ScreenScroll>
  );
}

function VitalsGrid({ log, styles, compact = false }: { log: HealthLog; styles: AppStyles; compact?: boolean }) {
  return (
    <View style={[styles.vitalsGrid, compact && styles.vitalsGridCompact]}>
      <View style={styles.vitalTile}><Text style={styles.vitalLabel}>Steps</Text><Text style={styles.vitalValue}>{fmt(log.steps)}</Text></View>
      <View style={styles.vitalTile}><Text style={styles.vitalLabel}>Calories</Text><Text style={styles.vitalValue}>{log.calories}</Text></View>
      <View style={styles.vitalTile}><Text style={styles.vitalLabel}>Water</Text><Text style={styles.vitalValue}>{log.water.toFixed(1)}L</Text></View>
      <View style={styles.vitalTile}><Text style={styles.vitalLabel}>Sleep</Text><Text style={styles.vitalValue}>{log.sleep.toFixed(1)}h</Text></View>
      <View style={styles.vitalTile}><Text style={styles.vitalLabel}>Mood</Text><Text style={styles.vitalValue}>{log.mood}/10</Text></View>
      <View style={styles.vitalTile}><Text style={styles.vitalLabel}>Stress</Text><Text style={styles.vitalValue}>{log.stress}/10</Text></View>
    </View>
  );
}

function Goals({ log, sessions, userGoals, onAddGoal, onDeleteGoal, styles, theme }: {
  log: HealthLog; sessions: WorkoutSession[]; userGoals: UserGoal[]; onAddGoal: (g: Omit<UserGoal, 'id'>) => void; onDeleteGoal: (id: string) => void; styles: AppStyles; theme: Theme;
}) {
  const [showForm, setShowForm] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalUnit, setGoalUnit] = useState('kg');

  const addGoalSubmit = () => {
    const t = Number(goalTarget);
    if (!goalName || !Number.isFinite(t) || t <= 0) return;
    onAddGoal({ name: goalName, target: t, unit: goalUnit });
    setGoalName(''); setGoalTarget(''); setShowForm(false);
  };

  const getCurrent = (name: string): number => {
    let maxW = 0;
    for (const s of sessions) {
      for (const e of s.exercises) {
        if (e.name.toLowerCase() === name.toLowerCase() && e.weight > maxW) maxW = e.weight;
      }
    }
    return maxW;
  };

  const healthGoals = [
    { label: 'Sleep', value: `${log.sleep.toFixed(1)}h`, progress: clamp(log.sleep / 8, 0, 1), icon: 'moon-outline' as IconName, color: '#E67E22' },
    { label: 'Steps', value: fmt(log.steps), progress: clamp(log.steps / 10000, 0, 1), icon: 'trending-up-outline' as IconName, color: '#FF6600' },
    { label: 'Calories', value: `${log.calories} kcal`, progress: clamp(log.calories / 650, 0, 1), icon: 'thunderstorm-outline' as IconName, color: '#FF8C00' },
    { label: 'Water', value: `${log.water.toFixed(1)} L`, progress: clamp(log.water / 3, 0, 1), icon: 'umbrella-outline' as IconName, color: '#FFAA33' },
    { label: 'Mood', value: `${log.mood}/10`, progress: clamp(log.mood / 10, 0, 1), icon: 'sunny-outline' as IconName, color: '#FFB347' },
    { label: 'Low Stress', value: `${log.stress}/10`, progress: 1 - clamp(log.stress / 10, 0, 1), icon: 'heart-outline' as IconName, color: '#FF4500' },
  ];

  return (
    <ScreenScroll styles={styles}>
      <LinearGradient colors={theme.heroGrad} style={styles.hero}>
        <View style={styles.heroContent}>
          <Text style={styles.heroKicker}>Daily targets</Text>
          <Text style={styles.heroTitle}>Your goals</Text>
          <Text style={styles.heroBody}>Track progress against your daily targets and set custom goals.</Text>
        </View>
      </LinearGradient>

      <Text style={styles.sectionTitle}>Daily Targets</Text>
      {healthGoals.map((g) => (
        <View key={g.label} style={styles.goalRow}>
          <View style={[styles.goalIconWrap, { backgroundColor: `${g.color}20` }]}><Ionicons name={g.icon} size={20} color={g.color} /></View>
          <View style={styles.goalBody}>
            <View style={styles.goalTop}><Text style={styles.goalLabel}>{g.label}</Text><Text style={styles.goalValue}>{g.value}</Text></View>
            <View style={styles.goalTrack}><View style={[styles.goalFill, { width: `${g.progress * 100}%`, backgroundColor: g.color }]} /></View>
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Custom Goals</Text>
      {userGoals.length === 0 && !showForm && (
        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.muted, textAlign: 'center', marginVertical: 20 }}>No goals yet. Set your first goal!</Text>
      )}
      {userGoals.map((g) => {
        const current = getCurrent(g.name);
        const progress = g.target > 0 ? clamp(current / g.target, 0, 1) : 0;
        return (
          <View key={g.id} style={styles.goalRow}>
            <View style={[styles.goalIconWrap, { backgroundColor: '#FF660020' }]}><Ionicons name="flag-outline" size={20} color="#FF6600" /></View>
            <View style={styles.goalBody}>
              <View style={styles.goalTop}>
                <Text style={styles.goalLabel}>{g.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.goalValue}>{current}{g.unit} / {g.target}{g.unit}</Text>
                  <Pressable onPress={() => onDeleteGoal(g.id)} style={{ padding: 4 }}><Ionicons name="trash-outline" size={16} color="#ef4444" /></Pressable>
                </View>
              </View>
              <View style={styles.goalTrack}><View style={[styles.goalFill, { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: progress >= 1 ? '#22c55e' : '#FF6600' }]} /></View>
              {current >= g.target && <Text style={{ fontSize: 12, fontWeight: '700', color: '#22c55e', marginTop: 4 }}>Goal reached! </Text>}
            </View>
          </View>
        );
      })}

      {showForm ? (
        <View style={styles.form}>
          <TextInput placeholder="Goal name (e.g. Bench Press)" value={goalName} onChangeText={setGoalName} style={styles.input} placeholderTextColor={theme.muted} />
          <View style={styles.formRow}>
            <TextInput placeholder="Target weight" value={goalTarget} onChangeText={setGoalTarget} keyboardType="decimal-pad" style={[styles.input, styles.inputHalf]} placeholderTextColor={theme.muted} />
            <View style={styles.unitRow}>
              <Pressable onPress={() => setGoalUnit('kg')} style={[styles.unitBtn, goalUnit === 'kg' && styles.unitBtnActive]}><Text style={[styles.unitBtnText, goalUnit === 'kg' && styles.unitBtnTextActive]}>kg</Text></Pressable>
              <Pressable onPress={() => setGoalUnit('lbs')} style={[styles.unitBtn, goalUnit === 'lbs' && styles.unitBtnActive]}><Text style={[styles.unitBtnText, goalUnit === 'lbs' && styles.unitBtnTextActive]}>lbs</Text></Pressable>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={() => setShowForm(false)} style={[styles.submitBtn, { flex: 1, backgroundColor: theme.input }]}><Text style={[styles.submitBtnText, { color: theme.muted }]}>Cancel</Text></Pressable>
            <Pressable onPress={addGoalSubmit} style={[styles.submitBtn, { flex: 1 }]}><Text style={styles.submitBtnText}>Add Goal</Text></Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setShowForm(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.input, borderRadius: 16, padding: 14, marginTop: 4 }}>
          <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.primary }}>Set a Goal</Text>
        </Pressable>
      )}
    </ScreenScroll>
  );
}

function ProfilePanel({ log, score, mode, profile, onProfileChange, onResetData, onClose, onMode, styles, theme }: {
  log: HealthLog; score: number; mode: ThemeMode; profile: UserProfile; onProfileChange: (profile: UserProfile) => void; onResetData: () => void;
  onClose: () => void; onMode: () => void; styles: AppStyles; theme: Theme;
}) {
  return (
    <View style={styles.overlay}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.panel}>
        <View style={styles.panelTop}>
          <View style={styles.avatar}><Ionicons name="person" size={28} color="#fff" /></View>
          <Pressable onPress={onClose} style={styles.closeBtn}><Ionicons name="close" size={20} color={theme.ink} /></Pressable>
        </View>
        <TextInput
          value={profile.name}
          onChangeText={(name) => onProfileChange({ ...profile, name })}
          placeholder="Your name"
          placeholderTextColor={theme.muted}
          style={styles.profileInput}
        />
        <TextInput
          value={profile.plan}
          onChangeText={(plan) => onProfileChange({ ...profile, plan })}
          placeholder="Profile note"
          placeholderTextColor={theme.muted}
          style={[styles.profileInput, styles.profileSubInput]}
        />
        <View style={styles.panelStats}>
          <View style={styles.panelStat}><Text style={styles.panelStatNum}>{score}</Text><Text style={styles.panelStatLabel}>Score</Text></View>
          <View style={styles.panelStat}><Text style={styles.panelStatNum}>{fmt(log.steps)}</Text><Text style={styles.panelStatLabel}>Steps</Text></View>
          <View style={styles.panelStat}><Text style={styles.panelStatNum}>{log.calories}</Text><Text style={styles.panelStatLabel}>Burn</Text></View>
        </View>
        <Pressable onPress={onMode} style={styles.themeRow}>
          <Text style={styles.panelName}>Dark Mode</Text>
          <Ionicons name={mode === 'dark' ? 'toggle' : 'toggle-outline'} size={36} color={mode === 'dark' ? theme.primary : theme.muted} />
        </Pressable>
        <Pressable onPress={onResetData} style={styles.resetDataBtn}>
          <Ionicons name="refresh-outline" size={18} color="#ef4444" />
          <Text style={styles.resetDataText}>Reset local data</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Nav({ active, onTab, styles, theme }: { active: TabKey; onTab: (t: TabKey) => void; styles: AppStyles; theme: Theme }) {
  return (
    <View style={styles.nav}>
      {tabs.map((t) => {
        const act = t.key === active;
        return (
          <Pressable key={t.key} onPress={() => onTab(t.key)} style={[styles.navItem, act && styles.navItemActive]}>
            <Ionicons name={t.icon as any} size={20} color={act ? theme.ink : theme.muted} />
            <Text style={[styles.navLabel, act && styles.navLabelActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function getTheme(mode: ThemeMode) {
  const light = {
    mode, primary: '#FF6600', secondary: '#FF8C00', accent: '#FFAA33',
    ink: '#2C1810', pine: '#5C3A28', moss: '#FF6600',
    mint: '#FFF3E0', mintDeep: '#FFE0B2', honey: '#FF6600', honeySoft: '#FFF3E0',
    bg: '#FFF8F0', paper: '#FFFFFF', elevated: '#FFFFFF', input: '#FFF3E0',
    line: '#FFE0B2', muted: '#8D6E63',
    darkPanel: '#2C1810', darkPanelInk: '#2C1810', darkPanelText: '#FFFFFF',
    orbHalo: '#FFF3E0', overlay: 'rgba(44, 24, 16, 0.42)',
    heroGrad: ['#FFFFFF', '#FFF3E0'] as const, navBg: 'rgba(255, 255, 255, 0.92)',
  };
  if (mode === 'light') return light;
  return {
    ...light, ink: '#FFE0B2', pine: '#FFCC99', mint: '#1A0E0A', mintDeep: '#FF6600',
    honeySoft: '#2C1810', bg: '#0D0705', paper: '#1A0E0A', elevated: '#2C1810',
    input: '#2C1810', line: '#3D2115', muted: '#8D6E63',
    darkPanel: '#FFE0B2', darkPanelInk: '#1A0E0A', darkPanelText: '#1A0E0A',
    orbHalo: '#2C1810', overlay: 'rgba(0, 0, 0, 0.66)',
    heroGrad: ['#2C1810', '#0D0705'] as const, navBg: 'rgba(13, 7, 5, 0.95)',
  };
}

function createShadow(theme: Theme) {
  return Platform.select({
    ios: { shadowColor: theme.mode === 'dark' ? '#000' : '#8D6E63', shadowOpacity: theme.mode === 'dark' ? 0.3 : 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } },
    android: { elevation: 4 },
    web: { boxShadow: theme.mode === 'dark' ? '0 12px 32px rgba(0,0,0,0.3)' : '0 12px 28px rgba(141,110,99,0.12)' },
    default: {},
  });
}

function createStyles(theme: Theme) {
  const sh = createShadow(theme);
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    shell: { flex: 1, backgroundColor: theme.bg },
    content: { flex: 1 },
    contentWide: { alignSelf: 'center', maxWidth: 860, width: '100%' },
    scroll: { paddingBottom: 120, paddingHorizontal: 16 },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, backgroundColor: theme.bg },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    brandName: { fontSize: 24, fontWeight: '800', color: theme.primary, letterSpacing: 0 },
    brandSub: { fontSize: 12, fontWeight: '600', color: theme.muted, marginTop: -2 },
    topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    topBtn: { width: 42, height: 42, borderRadius: 999, backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center' },
    hero: { borderRadius: 28, marginTop: 6, overflow: 'hidden', ...sh },
    heroContent: { padding: 22 },
    heroKicker: { fontSize: 12, fontWeight: '800', color: theme.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
    heroQuote: { fontSize: 20, fontWeight: '700', color: theme.ink, lineHeight: 28, fontStyle: 'italic', marginBottom: 8 },
    heroTitle: { fontSize: 32, fontWeight: '900', color: theme.ink, lineHeight: 36 },
    heroBody: { fontSize: 15, fontWeight: '600', color: theme.pine, lineHeight: 22, marginTop: 10 },
    orbWrap: { alignItems: 'center', marginTop: 16 },
    onboardingScreen: { flex: 1, backgroundColor: theme.bg, justifyContent: 'center', padding: 22 },
    onboardingCard: { borderRadius: 30, borderWidth: 1, borderColor: theme.line, padding: 26, alignItems: 'center', ...sh },
    onboardingLogo: { width: 126, height: 126, borderRadius: 32, marginBottom: 18 },
    onboardingTitle: { fontSize: 42, fontWeight: '900', color: theme.primary, letterSpacing: 0 },
    onboardingSubtitle: { fontSize: 14, fontWeight: '700', color: theme.muted, marginTop: 6, marginBottom: 22, textAlign: 'center' },
    onboardingInput: { alignSelf: 'stretch', backgroundColor: theme.input, borderRadius: 16, borderWidth: 1, borderColor: theme.line, fontSize: 18, fontWeight: '800', color: theme.ink, paddingHorizontal: 16, paddingVertical: 14, textAlign: 'center' },
    onboardingButton: { alignSelf: 'stretch', backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
    onboardingButtonDisabled: { opacity: 0.45 },
    onboardingButtonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
    sectionTitle: { fontSize: 16, fontWeight: '900', color: theme.primary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 24, marginBottom: 12 },
    vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    vitalsGridCompact: { marginTop: 2, marginBottom: 10 },
    vitalTile: { backgroundColor: theme.paper, borderRadius: 16, borderWidth: 1, borderColor: theme.line, flexBasis: '30%', flexGrow: 1, minWidth: 96, padding: 10 },
    vitalLabel: { fontSize: 12, fontWeight: '800', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
    vitalValue: { fontSize: 22, fontWeight: '900', color: theme.ink, marginTop: 2 },
    metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    metricCard: { backgroundColor: theme.paper, borderRadius: 22, borderWidth: 1, borderColor: theme.line, flexBasis: '47%', flexGrow: 1, padding: 14, ...sh },
    metricIconWrap: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    metricLabel: { fontSize: 12, fontWeight: '800', color: theme.pine, textTransform: 'uppercase', letterSpacing: 0.3 },
    valRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
    metricVal: { fontSize: 26, fontWeight: '900', color: theme.ink, letterSpacing: -0.5 },
    metricUnit: { fontSize: 12, fontWeight: '700', color: theme.muted },
    track: { backgroundColor: theme.input, borderRadius: 999, height: 5, marginTop: 10, overflow: 'hidden' },
    trackFill: { borderRadius: 999, height: '100%' },
    adjRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    adjBtn: { width: 28, height: 28, borderRadius: 999, backgroundColor: theme.input, alignItems: 'center', justifyContent: 'center' },
    editRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    editInput: { backgroundColor: theme.input, borderRadius: 10, flex: 1, fontSize: 18, fontWeight: '900', color: theme.ink, paddingHorizontal: 8, paddingVertical: 4 },
    editBtn: { width: 30, height: 30, borderRadius: 999, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
    predGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    predCard: { flexBasis: '47%', flexGrow: 1, borderRadius: 20, padding: 14, minHeight: 110, borderWidth: 1, borderColor: theme.line },
    predIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    predTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
    predVal: { fontSize: 22, fontWeight: '900', color: theme.ink, marginTop: 4 },
    predTrend: { fontSize: 12, fontWeight: '600', color: theme.muted, marginTop: 2 },
    actionCard: { borderRadius: 24, padding: 18, flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginTop: 16, ...sh },
    actionBody: { flex: 1 },
    actionLbl: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5 },
    actionTxt: { fontSize: 14, fontWeight: '700', color: '#fff', lineHeight: 20, marginTop: 4 },
    splitRow: { flexDirection: 'row', gap: 6 },
    splitBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: theme.input },
    splitBtnActive: { backgroundColor: theme.primary },
    splitBtnText: { fontSize: 13, fontWeight: '700', color: theme.muted },
    splitBtnTextActive: { color: '#fff' },
    dayRow: { flexDirection: 'row', gap: 6 },
    dayBtn: { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center', backgroundColor: theme.input },
    dayBtnActive: { backgroundColor: theme.primary },
    dayBtnText: { fontSize: 11, fontWeight: '700', color: theme.muted },
    dayBtnTextActive: { color: '#fff' },
    form: { backgroundColor: theme.paper, borderRadius: 22, borderWidth: 1, borderColor: theme.line, padding: 16, gap: 10, ...sh },
    selectedWorkoutCard: { backgroundColor: theme.input, borderRadius: 16, borderWidth: 1, borderColor: theme.line, padding: 12 },
    selectedWorkoutLabel: { fontSize: 11, fontWeight: '800', color: theme.muted, letterSpacing: 0, marginBottom: 2 },
    selectedWorkoutName: { fontSize: 18, fontWeight: '900', color: theme.ink },
    input: { backgroundColor: theme.input, borderRadius: 14, fontSize: 15, fontWeight: '600', color: theme.ink, paddingHorizontal: 14, paddingVertical: 12 },
    formRow: { flexDirection: 'row', gap: 10 },
    inputHalf: { flex: 1 },
    inputThird: { flex: 1 },
    unitRow: { flexDirection: 'row', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: theme.line },
    unitBtn: { paddingHorizontal: 18, paddingVertical: 12, backgroundColor: theme.input },
    unitBtnActive: { backgroundColor: theme.primary },
    unitBtnText: { fontSize: 14, fontWeight: '700', color: theme.muted },
    unitBtnTextActive: { color: '#fff' },
    submitBtn: { backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
    submitBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
    dateHeader: { fontSize: 14, fontWeight: '800', color: theme.primary, marginBottom: 8, marginTop: 4 },
    workoutRow: { backgroundColor: theme.paper, borderRadius: 16, borderWidth: 1, borderColor: theme.line, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 6 },
    workoutIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FF660020', alignItems: 'center', justifyContent: 'center' },
    workoutBody: { flex: 1 },
    workoutName: { fontSize: 15, fontWeight: '800', color: theme.ink },
    workoutDetail: { fontSize: 13, fontWeight: '600', color: theme.muted, marginTop: 2 },
    recordGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    recordCard: { backgroundColor: theme.paper, borderRadius: 22, borderWidth: 1, borderColor: theme.line, padding: 16, ...sh },
    recordIconWrap: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    filterRow: { gap: 8, paddingBottom: 4, marginBottom: 12 },
    filterChip: { borderRadius: 999, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.paper, paddingHorizontal: 14, paddingVertical: 9 },
    filterChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    filterChipText: { fontSize: 13, fontWeight: '800', color: theme.muted },
    filterChipTextActive: { color: '#fff' },
    recordExerciseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
    recordExerciseName: { flexShrink: 1, fontSize: 14, fontWeight: '800', color: theme.ink },
    recordExerciseDetail: { fontSize: 13, fontWeight: '600', color: theme.muted, marginTop: 2, flexWrap: 'wrap' },
    recordPrText: { flexShrink: 0, maxWidth: 86, fontSize: 11, fontWeight: '700', color: theme.muted, textAlign: 'right' },
    deleteRecordBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#ef444410', borderRadius: 12, padding: 10, marginTop: 10 },
    deleteRecordText: { fontSize: 13, fontWeight: '800', color: '#ef4444' },
    recordFoot: { marginTop: 8 },
    recordDate: { fontSize: 12, fontWeight: '700', color: theme.muted },
    recordTrend: { fontSize: 12, fontWeight: '800', color: theme.primary, marginTop: 2 },
    goalRow: { backgroundColor: theme.paper, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.line },
    goalIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    goalBody: { flex: 1 },
    goalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    goalLabel: { fontSize: 15, fontWeight: '800', color: theme.ink },
    goalValue: { fontSize: 14, fontWeight: '700', color: theme.pine },
    goalTrack: { backgroundColor: theme.input, borderRadius: 999, height: 8, marginTop: 10, overflow: 'hidden' },
    goalFill: { borderRadius: 999, height: '100%' },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 },
    scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.overlay },
    panel: { backgroundColor: theme.paper, borderRadius: 28, marginHorizontal: 20, marginTop: 80, padding: 24, ...sh },
    panelTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.input, alignItems: 'center', justifyContent: 'center' },
    profileInput: { backgroundColor: theme.input, borderRadius: 14, fontSize: 20, fontWeight: '900', color: theme.ink, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10 },
    profileSubInput: { fontSize: 14, fontWeight: '700', color: theme.muted, marginTop: 8 },
    panelName: { fontSize: 22, fontWeight: '900', color: theme.ink, marginTop: 12 },
    panelPlan: { fontSize: 14, fontWeight: '600', color: theme.muted, marginTop: 2 },
    panelStats: { flexDirection: 'row', gap: 10, marginTop: 20 },
    panelStat: { backgroundColor: theme.input, borderRadius: 16, flex: 1, padding: 12, alignItems: 'center' },
    panelStatNum: { fontSize: 22, fontWeight: '900', color: theme.ink },
    panelStatLabel: { fontSize: 11, fontWeight: '700', color: theme.muted, marginTop: 2 },
    themeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.input, borderRadius: 16, padding: 14, marginTop: 16 },
    resetDataBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#ef444410', borderRadius: 16, padding: 14, marginTop: 10 },
    resetDataText: { fontSize: 14, fontWeight: '800', color: '#ef4444' },
    nav: { position: 'absolute', bottom: 14, left: 14, right: 14, flexDirection: 'row', backgroundColor: theme.navBg, borderRadius: 28, padding: 6, borderWidth: 1, borderColor: theme.line, alignSelf: 'center', maxWidth: 600, ...sh },
    navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 22, paddingVertical: 10, gap: 2 },
    navItemActive: { backgroundColor: theme.mint },
    navLabel: { fontSize: 10, fontWeight: '700', color: theme.muted },
    navLabelActive: { color: theme.ink },
  });
}

function calcScore(log: HealthLog) {
  return Math.round(clamp(log.steps / 10000, 0, 1) * 24 + clamp(log.sleep / 8, 0, 1) * 26 + (1 - clamp(log.stress / 10, 0, 1)) * 18 + clamp(log.mood / 10, 0, 1) * 14 + clamp(log.water / 3, 0, 1) * 10 + clamp(log.calories / 650, 0, 1) * 8);
}

function getPredictions(log: HealthLog) {
  const base = [
    { title: 'Energy', icon: 'flash-outline' as IconName },
    { title: 'Sleep', icon: 'moon-outline' as IconName },
    { title: 'Overtraining', icon: 'barbell-outline' as IconName },
    { title: 'Calorie Burn', icon: 'flame-outline' as IconName },
  ];
  return base.map((item) => {
    if (item.title === 'Energy') return { ...item, value: `${Math.max(3, Math.min(9, Math.round((log.sleep + log.mood - log.stress / 2) * 0.7)))} /10`, trend: log.sleep >= 7 ? 'stable' : 'sleep debt' };
    if (item.title === 'Sleep') return { ...item, value: log.stress > 6 ? 'At risk' : 'Good', trend: log.stress > 6 ? 'wind down earlier' : '7.5h target' };
    if (item.title === 'Overtraining') { const r = clamp(Math.round((log.calories / 900) * 45 + log.stress * 4), 12, 74); return { ...item, value: `${r}%`, trend: r > 45 ? 'reduce' : 'ok' }; }
    return { ...item, value: `${log.calories} kcal`, trend: `${fmt(log.steps)} steps` };
  });
}

function getTopAction(log: HealthLog) {
  if (log.water < 2) return `Hydrate now — only ${log.water.toFixed(1)}L today. Target is 3.0L.`;
  if (log.steps < 7000) return `Take a 10-min walk! ${fmt(10000 - log.steps)} steps to go.`;
  if (log.sleep < 7) return "Wind down 30 min earlier to protect tonight's sleep.";
  return "Everything looks balanced. Keep it up!";
}

function fmt(v: number) { return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function fmtDate(d: string) { const [y, m, day] = d.split('-'); return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m) - 1]} ${parseInt(day)}, ${y}`; }
function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }
