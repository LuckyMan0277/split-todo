/**
 * BallGameScreen
 *
 * Cup Hero-inspired mini-game:
 * - Tap on the board to drop a ball at that x position.
 * - Falling balls pass through ×N multiplier gates which spawn (N-1) copies.
 * - Balls that reach the bottom deal 1 damage each to the boss.
 * - Defeat the boss to advance to the next level (harder boss + fresh gates).
 *
 * Implementation notes:
 * - Physics runs on a single setInterval @ ~60fps that mutates a ref-held ball
 *   list and bumps a tick counter to trigger re-render. Mutating refs avoids
 *   the cost of recreating the ball array each frame.
 * - Total active balls capped at MAX_BALLS for performance.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../styles/colors';
import { spacing } from '../styles/spacing';
import { typography } from '../styles/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOARD_WIDTH = Math.min(SCREEN_WIDTH - spacing.xxl * 2, 480);
const BOARD_HEIGHT = 540;

const BALL_SIZE = 12;
const BALL_RADIUS = BALL_SIZE / 2;
const GATE_HEIGHT = 32;
const GRAVITY = 0.22;
const MAX_FALL_SPEED = 9;
const WALL_BOUNCE = 0.55;
const MAX_BALLS = 180;
const FRAME_MS = 16;
const SHOTS_PER_ROUND = 8;
const INITIAL_BOSS_HP = 50;

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  passed: number[];
}

interface Gate {
  id: number;
  x: number;
  width: number;
  y: number;
  multiplier: number;
}

let nextBallId = 0;

const pickMultiplier = (): number => {
  const roll = Math.random();
  if (roll < 0.55) return 2;
  if (roll < 0.85) return 3;
  return 5;
};

const buildGates = (level: number): Gate[] => {
  const rows = 3;
  const gates: Gate[] = [];
  let id = 0;
  for (let r = 0; r < rows; r++) {
    const y = 100 + r * 130;
    const segments = 2 + ((level + r) % 2); // 2 or 3 segments per row
    const segWidth = BOARD_WIDTH / segments;
    for (let s = 0; s < segments; s++) {
      gates.push({
        id: id++,
        x: s * segWidth + 4,
        width: segWidth - 8,
        y,
        multiplier: pickMultiplier(),
      });
    }
  }
  return gates;
};

const gateColor = (m: number): string => {
  if (m === 2) return '#34d399'; // emerald
  if (m === 3) return '#facc15'; // yellow
  return '#fb923c'; // orange (×5)
};

export default function BallGameScreen() {
  const [level, setLevel] = useState(1);
  const [bossMaxHp, setBossMaxHp] = useState(INITIAL_BOSS_HP);
  const [bossHp, setBossHp] = useState(INITIAL_BOSS_HP);
  const [shotsLeft, setShotsLeft] = useState(SHOTS_PER_ROUND);
  const [score, setScore] = useState(0);
  const [gates, setGates] = useState<Gate[]>(() => buildGates(1));
  const [, setTick] = useState(0);

  const ballsRef = useRef<Ball[]>([]);
  const gatesRef = useRef<Gate[]>(gates);
  const bossHpRef = useRef(bossHp);

  useEffect(() => {
    gatesRef.current = gates;
  }, [gates]);

  useEffect(() => {
    bossHpRef.current = bossHp;
  }, [bossHp]);

  // Game loop. We run continuously; UI states gate what tapping does.
  useEffect(() => {
    const interval = setInterval(() => {
      const balls = ballsRef.current;
      if (balls.length === 0) {
        // Still bump the tick occasionally so overlays update; cheap no-op otherwise.
        return;
      }

      const surviving: Ball[] = [];
      const spawned: Ball[] = [];
      let damage = 0;

      for (const b of balls) {
        b.vy = Math.min(MAX_FALL_SPEED, b.vy + GRAVITY);
        b.x += b.vx;
        b.y += b.vy;

        if (b.x < BALL_RADIUS) {
          b.x = BALL_RADIUS;
          b.vx = -b.vx * WALL_BOUNCE;
        } else if (b.x > BOARD_WIDTH - BALL_RADIUS) {
          b.x = BOARD_WIDTH - BALL_RADIUS;
          b.vx = -b.vx * WALL_BOUNCE;
        }

        if (b.y >= BOARD_HEIGHT - BALL_RADIUS) {
          damage += 1;
          continue;
        }

        for (const g of gatesRef.current) {
          if (b.passed.includes(g.id)) continue;
          const inXRange = b.x >= g.x && b.x <= g.x + g.width;
          if (!inXRange) continue;
          const intersectsBand = b.y + BALL_RADIUS >= g.y && b.y - BALL_RADIUS <= g.y + GATE_HEIGHT;
          if (!intersectsBand) continue;

          b.passed.push(g.id);
          const totalActive = surviving.length + spawned.length + 1;
          const room = Math.max(0, MAX_BALLS - totalActive);
          const copies = Math.min(g.multiplier - 1, room);
          for (let k = 0; k < copies; k++) {
            spawned.push({
              id: nextBallId++,
              x: b.x,
              y: b.y,
              vx: (Math.random() - 0.5) * 3.5,
              vy: b.vy * 0.85,
              passed: b.passed.slice(),
            });
          }
          break; // at most one gate-hit per frame per ball
        }

        surviving.push(b);
      }

      const next = surviving.concat(spawned);
      ballsRef.current = next.length > MAX_BALLS ? next.slice(0, MAX_BALLS) : next;

      if (damage > 0) {
        const newHp = Math.max(0, bossHpRef.current - damage);
        bossHpRef.current = newHp;
        setBossHp(newHp);
        setScore((s) => s + damage);
      }

      setTick((t) => (t + 1) & 0xffff);
    }, FRAME_MS);

    return () => clearInterval(interval);
  }, []);

  // Level up when boss is defeated and battlefield is clear.
  useEffect(() => {
    if (bossHp > 0) return;
    if (ballsRef.current.length > 0) return;
    const nextLevel = level + 1;
    const nextHp = Math.round(bossMaxHp * 1.6);
    setLevel(nextLevel);
    setBossMaxHp(nextHp);
    setBossHp(nextHp);
    setGates(buildGates(nextLevel));
    setShotsLeft(SHOTS_PER_ROUND);
  }, [bossHp, level, bossMaxHp]);

  const handleShoot = useCallback(
    (tapX: number) => {
      if (shotsLeft <= 0) return;
      if (bossHp <= 0) return;
      if (ballsRef.current.length >= MAX_BALLS) return;
      const x = Math.max(BALL_RADIUS, Math.min(BOARD_WIDTH - BALL_RADIUS, tapX));
      ballsRef.current.push({
        id: nextBallId++,
        x,
        y: 6,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 0.4,
        passed: [],
      });
      setShotsLeft((s) => s - 1);
    },
    [shotsLeft, bossHp]
  );

  const handleResetRound = useCallback(() => {
    ballsRef.current = [];
    setShotsLeft(SHOTS_PER_ROUND);
    setBossHp(bossMaxHp);
    bossHpRef.current = bossMaxHp;
  }, [bossMaxHp]);

  const handleNewGame = useCallback(() => {
    ballsRef.current = [];
    setLevel(1);
    setBossMaxHp(INITIAL_BOSS_HP);
    setBossHp(INITIAL_BOSS_HP);
    bossHpRef.current = INITIAL_BOSS_HP;
    setGates(buildGates(1));
    setShotsLeft(SHOTS_PER_ROUND);
    setScore(0);
  }, []);

  const balls = ballsRef.current;
  const ballCount = balls.length;
  const hpPercent = bossMaxHp > 0 ? Math.max(0, (bossHp / bossMaxHp) * 100) : 0;

  const isRoundEmpty = shotsLeft === 0 && ballCount === 0 && bossHp > 0;

  const gateNodes = useMemo(
    () =>
      gates.map((g) => (
        <View
          key={g.id}
          style={[
            styles.gate,
            {
              left: g.x,
              top: g.y,
              width: g.width,
              backgroundColor: gateColor(g.multiplier),
            },
          ]}
        >
          <Text style={styles.gateText}>×{g.multiplier}</Text>
        </View>
      )),
    [gates]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.statusBar}>
        <StatusItem label="레벨" value={String(level)} />
        <StatusItem label="점수" value={String(score)} />
        <StatusItem label="발사" value={`${shotsLeft}/${SHOTS_PER_ROUND}`} />
        <StatusItem label="활성 공" value={String(ballCount)} />
      </View>

      <View style={styles.bossArea}>
        <Text style={styles.bossEmoji}>👹</Text>
        <View style={styles.hpBarContainer}>
          <View style={[styles.hpBarFill, { width: `${hpPercent}%` }]} />
          <Text style={styles.hpText}>
            {bossHp} / {bossMaxHp}
          </Text>
        </View>
      </View>

      <View style={styles.boardWrapper}>
        <Pressable
          style={styles.board}
          onPress={(e) => handleShoot(e.nativeEvent.locationX)}
          accessibilityRole="button"
          accessibilityLabel="공 떨어뜨리기"
          accessibilityHint="화면을 탭한 위치에서 공이 떨어집니다"
        >
          {gateNodes}

          {balls.map((b) => (
            <View
              key={b.id}
              style={[
                styles.ball,
                {
                  transform: [{ translateX: b.x - BALL_RADIUS }, { translateY: b.y - BALL_RADIUS }],
                },
              ]}
            />
          ))}

          <View style={styles.cup} pointerEvents="none">
            <Text style={styles.cupLabel}>🏆 컵</Text>
          </View>

          {isRoundEmpty && (
            <View style={styles.overlay} pointerEvents="box-none">
              <Text style={styles.overlayTitle}>발사를 모두 사용했어요</Text>
              <Text style={styles.overlaySubtitle}>
                보스 HP {bossHp} 남음 — 라운드를 다시 도전해 보세요
              </Text>
              <Pressable style={[styles.button, styles.primaryButton]} onPress={handleResetRound}>
                <Text style={styles.primaryButtonText}>라운드 리셋</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Pressable style={[styles.button, styles.secondaryButton]} onPress={handleNewGame}>
          <Text style={styles.secondaryButtonText}>새 게임</Text>
        </Pressable>
        <Text style={styles.helperText}>
          판을 탭한 위치에서 공이 떨어집니다. 게이트(×N)를 통과하면 N배로 복사됩니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}

interface StatusItemProps {
  label: string;
  value: string;
}

function StatusItem({ label, value }: StatusItemProps) {
  return (
    <View style={styles.statusItem}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusItem: {
    alignItems: 'center',
  },
  statusLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statusValue: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: 2,
  },
  bossArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  bossEmoji: {
    fontSize: 32,
  },
  hpBarContainer: {
    flex: 1,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.backgroundDark,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  hpBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.danger,
  },
  hpText: {
    ...typography.caption,
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '700',
  },
  boardWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: spacing.md,
  },
  board: {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  gate: {
    position: 'absolute',
    height: GATE_HEIGHT,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gateText: {
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 14,
  },
  ball: {
    position: 'absolute',
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_RADIUS,
    backgroundColor: '#fde68a',
    left: 0,
    top: 0,
  },
  cup: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.35)',
    borderTopWidth: 2,
    borderTopColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cupLabel: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  overlayTitle: {
    ...typography.h2,
    color: '#ffffff',
    marginBottom: spacing.sm,
  },
  overlaySubtitle: {
    ...typography.body,
    color: '#e5e7eb',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  button: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
    minHeight: 44,
    minWidth: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  helperText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
