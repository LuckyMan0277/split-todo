# 개발자 검토 의견

## 검토 요약
- **검토 날짜**: 2025-11-06
- **기술적 실현 가능성**: 상
- **전반적 평가**: 82/100
- **권장 개발 기간**: MVP 4-6주 (1명 풀타임 기준)

## ✅ 기술적으로 우수한 점

### 1. 적절한 기술 스택 선택
- **React Native + Expo**: 크로스 플랫폼 개발에 최적, 빠른 프로토타이핑 가능
- **Zustand**: Redux보다 가볍고 학습 곡선 낮음, 500ms debounce 저장에 적합
- **AsyncStorage**: 오프라인 앱에 완벽한 선택, 용량 제한(6-10MB)도 충분
- **TypeScript**: 타입 안전성으로 런타임 에러 사전 방지

### 2. 명확한 데이터 모델
```typescript
// 잘 설계된 인터페이스
interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

interface Task {
  id: string;
  title: string;
  items: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
  schemaVersion?: number;  // ✅ 향후 마이그레이션 대비
}
```
- **강점**: 정규화되지 않은 단순한 구조로 오프라인 앱에 최적
- **강점**: schemaVersion으로 향후 확장성 고려

### 3. 현실적인 성능 목표
- 초기 로딩 500ms: **달성 가능** (AsyncStorage는 100-200ms 수준)
- UI 반응 100ms: **달성 가능** (간단한 체크박스 토글)
- 500ms debounce: **적절함** (과도한 저장 방지)

### 4. 접근성 고려
- WCAG AA 기준 명시: ✅
- accessibilityLabel 계획: ✅
- 색상+텍스트 이중 표현: ✅

### 5. 체계적인 작업 분해
- 13단계로 명확하게 구분된 tasks.md
- 각 단계별 체크리스트 형태로 추적 가능

---

## ⚠️ 기술적 우려사항

### Critical (구현 전 해결 필요)

#### 1. AsyncStorage 용량 제한 고려 부족
- **문제**:
  - Task 1000개 × Checklist 200개 = 최대 200,000개 항목
  - 각 항목 평균 100자 × 2byte = 20MB 이상 가능
  - AsyncStorage 권장 용량: 6-10MB (플랫폼별 차이)
- **영향**: 저장 실패, 앱 크래시, 데이터 손실
- **해결책**:
  ```typescript
  // 1. 최대 개수 현실화
  const LIMITS = {
    MAX_TASKS: 200,        // 1000개 → 200개
    MAX_ITEMS_PER_TASK: 50 // 200개 → 50개
  };

  // 2. 저장 크기 측정 함수 추가 (tasks.md 3단계)
  function calculateStorageSize(data: AppData): number {
    const json = JSON.stringify(data);
    return new Blob([json]).size;
  }

  // 3. 저장 전 크기 검증 (tasks.md 4단계)
  async function saveAppData(data: AppData): Promise<void> {
    const size = calculateStorageSize(data);
    if (size > 5 * 1024 * 1024) { // 5MB 제한
      throw new Error('Data size exceeds limit');
    }
    // ... 저장 로직
  }
  ```
- **우선순위**: P0 (MVP 필수)

#### 2. 스키마 마이그레이션 전략 불명확
- **문제**:
  - tasks.md 4단계에 "스키마 마이그레이션 함수"만 언급
  - 구체적인 마이그레이션 로직 없음
  - 버전 1 → 2 시나리오 미정의
- **영향**: 앱 업데이트 시 기존 사용자 데이터 손실 위험
- **해결책**:
  ```typescript
  // src/services/storage.ts에 추가
  async function migrateSchema(
    data: any,
    fromVersion: number
  ): Promise<AppData> {
    let migrated = data;

    // v1 → v2: createdAt, updatedAt 추가 예시
    if (fromVersion < 2) {
      migrated.tasks = migrated.tasks.map((task: any) => ({
        ...task,
        createdAt: task.createdAt || new Date().toISOString(),
        updatedAt: task.updatedAt || new Date().toISOString(),
      }));
      migrated.schemaVersion = 2;
    }

    return migrated;
  }

  async function loadAppData(): Promise<AppData> {
    const raw = await AsyncStorage.getItem('APP_DATA');
    if (!raw) return createEmptyData();

    const data = JSON.parse(raw);
    const currentVersion = data.schemaVersion || 1;
    const LATEST_VERSION = 1;

    if (currentVersion < LATEST_VERSION) {
      return await migrateSchema(data, currentVersion);
    }

    return data;
  }
  ```
- **우선순위**: P0 (MVP 필수, 향후 확장 위해)

#### 3. 동시성 문제 (Race Condition)
- **문제**:
  - 500ms debounce 저장 중 앱 종료 → 데이터 손실
  - 빠른 연속 액션 시 상태 불일치 가능
  ```typescript
  // 문제 시나리오:
  // t=0ms: toggleChecklistItem (저장 예약: t=500ms)
  // t=100ms: deleteChecklistItem (저장 예약: t=600ms)
  // t=400ms: 앱 종료 → 두 변경 모두 손실
  ```
- **영향**: 사용자 데이터 손실, 신뢰도 저하
- **해결책**:
  ```typescript
  // src/store/taskStore.ts에 추가
  import { AppState, AppStateStatus } from 'react-native';

  const store = create<TaskState>((set, get) => ({
    // ... 기존 state

    // 즉시 저장 플래그
    saveImmediately: async () => {
      const state = get();
      await saveAppData({
        schemaVersion: 1,
        tasks: state.tasks,
      });
    },

    initialize: async () => {
      const data = await loadAppData();
      set({ tasks: data.tasks, isLoading: false });

      // ✅ 앱 백그라운드/종료 시 즉시 저장
      AppState.addEventListener('change', async (nextState: AppStateStatus) => {
        if (nextState === 'background' || nextState === 'inactive') {
          await get().saveImmediately();
        }
      });
    },
  }));
  ```
- **우선순위**: P0 (MVP 필수)

#### 4. 인라인 편집 UX 복잡도
- **문제**:
  - app-plan.md: "Task 제목: 탭하여 인라인 편집"
  - Checklist 항목도 "탭하여 인라인 편집"
  - 체크박스 탭 vs 제목 탭 구분 어려움
- **영향**: 오작동 빈번, 사용자 불만
- **해결책**:
  ```typescript
  // Option A: 롱프레스로 편집 모드 진입 (권장)
  <TouchableOpacity
    onPress={onToggleCheck}
    onLongPress={onEnterEditMode}
    delayLongPress={500}
  >
    <Checkbox checked={item.done} />
    <Text>{item.title}</Text>
  </TouchableOpacity>

  // Option B: 명시적 편집 버튼 추가 (더 안전)
  <View>
    <Checkbox onPress={onToggleCheck} />
    <Text>{item.title}</Text>
    <IconButton icon="edit" onPress={onEnterEditMode} />
  </View>
  ```
- **개발 시간**: Option A = 4h, Option B = 2h
- **우선순위**: P1 (MVP 강력 권장)

---

### High (구현 중 주의 필요)

#### 5. 대량 데이터 성능 최적화 부족
- **문제**:
  - 목표: Task 500개, Checklist 100개
  - tasks.md에 최적화 전략 부재
  - FlatList만으로 충분하지 않을 수 있음
- **영향**: 스크롤 버벅임, 앱 느려짐
- **해결책**:
  ```typescript
  // 1. FlatList 최적화 (tasks.md 7단계에 추가)
  <FlatList
    data={tasks}
    renderItem={renderTaskCard}
    keyExtractor={(item) => item.id}
    // ✅ 성능 최적화 props
    removeClippedSubviews={true}
    maxToRenderPerBatch={10}
    updateCellsBatchingPeriod={50}
    windowSize={21}
    initialNumToRender={10}
    getItemLayout={(data, index) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    })}
  />

  // 2. 진행률 계산 메모이제이션 (tasks.md 3단계에 추가)
  import { useMemo } from 'react';

  function TaskCard({ task }: { task: Task }) {
    const progress = useMemo(() => {
      return calcProgress(task.items);
    }, [task.items]); // items 변경 시만 재계산

    return <View>...</View>;
  }

  // 3. Zustand에서 선택적 구독 (tasks.md 5단계에 추가)
  // Bad: 전체 tasks 구독 (모든 변경에 리렌더)
  const tasks = useTaskStore((state) => state.tasks);

  // Good: 특정 task만 구독
  const task = useTaskStore((state) =>
    state.tasks.find(t => t.id === taskId)
  );
  ```
- **우선순위**: P1 (MVP 권장)

#### 6. 에러 처리 시나리오 불완전
- **문제**:
  - app-plan.md 489줄: "저장 실패: 사용자에게 알림"만 명시
  - 구체적인 에러 타입별 처리 없음
- **영향**: 사용자에게 불친절한 에러 메시지
- **해결책**:
  ```typescript
  // src/utils/errors.ts 추가 (tasks.md 3단계)
  export enum ErrorCode {
    STORAGE_FULL = 'STORAGE_FULL',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    DATA_CORRUPTED = 'DATA_CORRUPTED',
    UNKNOWN = 'UNKNOWN',
  }

  export function getUserFriendlyMessage(code: ErrorCode): string {
    switch (code) {
      case ErrorCode.STORAGE_FULL:
        return '저장 공간이 부족합니다. 완료된 할 일을 삭제해주세요.';
      case ErrorCode.PERMISSION_DENIED:
        return '저장 권한이 필요합니다. 설정에서 권한을 허용해주세요.';
      case ErrorCode.DATA_CORRUPTED:
        return '데이터가 손상되었습니다. 백업에서 복원하시겠습니까?';
      default:
        return '알 수 없는 오류가 발생했습니다.';
    }
  }

  // src/services/storage.ts에서 활용
  async function saveAppData(data: AppData): Promise<void> {
    try {
      await AsyncStorage.setItem('APP_DATA', JSON.stringify(data));
    } catch (error: any) {
      if (error.message.includes('quota')) {
        throw new AppError(ErrorCode.STORAGE_FULL);
      } else if (error.message.includes('permission')) {
        throw new AppError(ErrorCode.PERMISSION_DENIED);
      }
      throw new AppError(ErrorCode.UNKNOWN);
    }
  }
  ```
- **우선순위**: P1 (MVP 권장)

#### 7. 디자이너 제안사항 구현 복잡도 높음
- **문제**:
  - designer-review.md에서 애니메이션, 햅틱 피드백 등 제안
  - 일부는 구현 복잡도가 MVP 범위를 벗어남
- **구현 난이도 평가**:
  | 제안 | 난이도 | 시간 | MVP 포함 여부 |
  |------|--------|------|--------------|
  | 색상 대비 개선 | ⭐ | 0.5h | ✅ 필수 |
  | accessibilityLabel | ⭐⭐ | 2h | ✅ 필수 |
  | 진행률 바 애니메이션 | ⭐⭐ | 3h | ⚠️ 선택 |
  | 완료 축하 애니메이션 | ⭐⭐⭐ | 8h | ❌ Post-MVP |
  | 드래그 앤 드롭 | ⭐⭐⭐⭐ | 12h | ❌ Post-MVP |
  | 햅틱 피드백 | ⭐ | 1h | ✅ 권장 |
- **해결책**: 우선순위 재조정
  ```markdown
  # MVP 포함 (필수):
  - 색상 대비 개선
  - accessibilityLabel 추가
  - 터치 영역 44x44pt 보장
  - 햅틱 피드백 (구현 간단)

  # MVP 포함 (시간 있으면):
  - 간단한 진행률 바 애니메이션 (react-native-reanimated)
  - 체크박스 토글 애니메이션

  # Post-MVP:
  - 완료 축하 애니메이션 (confetti 등)
  - 드래그 앤 드롭 순서 변경
  ```
- **우선순위**: P2 (우선순위 합의 필요)

#### 8. UUID 라이브러리 설정 누락 가능성
- **문제**:
  - tasks.md 3단계에 "react-native-get-random-values import" 언급
  - **중요**: import 순서가 매우 중요 (번들러 이슈)
- **영향**: UUID 생성 실패, 앱 크래시
- **해결책**:
  ```typescript
  // ✅ App.tsx 최상단에 반드시 추가
  import 'react-native-get-random-values'; // 다른 import보다 먼저!
  import { v4 as uuidv4 } from 'uuid';
  import React from 'react';
  // ... 기타 imports

  // src/utils/uuid.ts
  import { v4 as uuidv4 } from 'uuid';

  export function generateId(): string {
    return uuidv4();
  }
  ```
- **우선순위**: P1 (MVP 필수)

---

## 🏗 아키텍처 검토

### 상태 관리: Zustand
**평가**: ✅ 적절한 선택

**장점**:
- Redux보다 보일러플레이트 80% 감소
- 500ms debounce 저장 로직 구현 용이
- React DevTools 지원 (디버깅 가능)

**우려사항**:
- ⚠️ tasks.md 5단계에서 `scheduleSave()` 구현 누락
- ⚠️ debounce 로직 취소 처리 명시 필요

**개선안**:
```typescript
// src/store/taskStore.ts
import { create } from 'zustand';
import { debounce } from 'lodash'; // 또는 직접 구현

let saveTimer: NodeJS.Timeout | null = null;

const store = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,

  // ✅ debounce 저장 스케줄러
  scheduleSave: debounce(async () => {
    const state = get();
    await saveAppData({
      schemaVersion: 1,
      tasks: state.tasks,
    });
  }, 500),

  addTask: (title: string) => {
    const newTask: Task = {
      id: generateId(),
      title,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      tasks: [...state.tasks, newTask],
    }));

    get().scheduleSave(); // ✅ 저장 예약
  },

  // 다른 액션들도 동일하게 scheduleSave() 호출
}));
```

**추가 권장사항**:
- Zustand middleware 활용 (persist, devtools)
- 단, AsyncStorage와 중복 저장 주의

---

### 데이터 저장: AsyncStorage
**평가**: ✅ 적절하지만 제한 사항 고려 필요

**장점**:
- 오프라인 앱에 완벽한 선택
- 간단한 key-value 저장소
- React Native 공식 지원

**제한사항**:
| 플랫폼 | 용량 제한 | 비고 |
|--------|----------|------|
| iOS | 무제한 (실질 ~10MB) | 시스템이 정리 가능 |
| Android | 6MB (default) | 설정 변경 가능 |

**권장 전략**:
```typescript
// src/services/storage.ts
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB (안전 마진)

async function saveAppData(data: AppData): Promise<void> {
  const json = JSON.stringify(data);
  const size = new Blob([json]).size;

  if (size > MAX_STORAGE_SIZE) {
    // ✅ 자동 정리: 완료된 Task 중 오래된 것부터 삭제
    const cleaned = await cleanOldCompletedTasks(data);
    return saveAppData(cleaned); // 재귀 (최대 1회)
  }

  try {
    await AsyncStorage.setItem('APP_DATA', json);
    await AsyncStorage.setItem('APP_DATA_BACKUP', json);
  } catch (error) {
    // 1회 재시도 (tasks.md 4단계 명시)
    await AsyncStorage.setItem('APP_DATA', json);
  }
}

async function cleanOldCompletedTasks(data: AppData): Promise<AppData> {
  // 100% 완료된 Task 중 updatedAt 기준 30일 이상 지난 것 삭제
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  return {
    ...data,
    tasks: data.tasks.filter((task) => {
      const isCompleted = calcProgress(task.items).percent === 100;
      const isOld = new Date(task.updatedAt) < cutoffDate;
      return !(isCompleted && isOld);
    }),
  };
}
```

---

### 성능 최적화: debounce, 메모이제이션
**평가**: ⚠️ 전략은 좋으나 세부 구현 필요

**debounce 500ms**:
- ✅ 적절한 밸런스 (너무 짧으면 저장 빈번, 너무 길면 데이터 손실 위험)
- ⚠️ 앱 종료 시 즉시 저장 로직 추가 필요 (위에서 언급)

**메모이제이션**:
```typescript
// ✅ useMemo로 진행률 계산 캐싱
import { useMemo } from 'react';

function TaskCard({ task }: { task: Task }) {
  const progress = useMemo(() => {
    return calcProgress(task.items);
  }, [task.items]);

  return (
    <View>
      <Text>{task.title}</Text>
      <ProgressBar percent={progress.percent} />
      <Text>{progress.done}/{progress.total} 완료</Text>
    </View>
  );
}

// ✅ React.memo로 컴포넌트 리렌더 방지
export const TaskCard = React.memo(
  TaskCardComponent,
  (prevProps, nextProps) => {
    // task.items 배열이 변경되지 않으면 리렌더 안 함
    return prevProps.task.id === nextProps.task.id &&
           prevProps.task.items === nextProps.task.items;
  }
);
```

**FlatList 최적화**:
- ✅ `getItemLayout` 사용 (스크롤 성능 2배 향상)
- ✅ `removeClippedSubviews={true}` (메모리 절약)
- ⚠️ tasks.md 7단계에 구체적 props 명시 필요

---

## 📊 성능 요구사항 검증

### 초기 로딩 500ms
**달성 가능 여부**: ✅ 가능

**분석**:
```typescript
// 초기 로딩 시간 분해:
// 1. AsyncStorage 읽기: ~100ms
// 2. JSON 파싱: ~50ms (Task 500개 기준)
// 3. Zustand store 초기화: ~10ms
// 4. 첫 화면 렌더: ~100ms
// 총: ~260ms (여유 240ms)
```

**측정 방법** (tasks.md 12단계에 추가):
```typescript
// App.tsx
import { useEffect } from 'react';
import { performance } from 'react-native-performance';

function App() {
  useEffect(() => {
    const start = performance.now();

    initialize().then(() => {
      const end = performance.now();
      console.log(`Initial load: ${end - start}ms`);

      if (end - start > 500) {
        console.warn('⚠️ Initial load exceeded 500ms target');
      }
    });
  }, []);

  // ...
}
```

**최적화 팁**:
- ✅ Hermes 엔진 사용 (Expo 기본 활성화)
- ✅ 초기 렌더 항목 제한 (`initialNumToRender={10}`)
- ✅ 스플래시 스크린으로 체감 시간 단축

---

### UI 반응 100ms
**달성 가능 여부**: ✅ 가능

**분석**:
```typescript
// 체크박스 토글 시간 분해:
// 1. 터치 이벤트: ~16ms (1 frame @ 60fps)
// 2. Zustand state 업데이트: ~5ms
// 3. 컴포넌트 리렌더: ~20ms
// 4. 저장 스케줄링 (비동기): ~1ms
// 총: ~42ms (여유 58ms)
```

**주의사항**:
- ⚠️ 진행률 계산이 느리면 100ms 초과 가능
- ⚠️ Task당 Checklist 100개면 계산 오래 걸릴 수 있음

**최적화**:
```typescript
// ❌ Bad: O(n) 계산을 매번 실행
function toggleChecklistItem(taskId: string, itemId: string) {
  set((state) => ({
    tasks: state.tasks.map((task) => {
      if (task.id !== taskId) return task;

      const newItems = task.items.map((item) =>
        item.id === itemId ? { ...item, done: !item.done } : item
      );

      // ❌ calcProgress 여기서 호출하면 느림
      const progress = calcProgress(newItems);

      return { ...task, items: newItems };
    }),
  }));
}

// ✅ Good: 진행률은 컴포넌트에서 useMemo로 계산
function toggleChecklistItem(taskId: string, itemId: string) {
  set((state) => ({
    tasks: state.tasks.map((task) => {
      if (task.id !== taskId) return task;

      return {
        ...task,
        items: task.items.map((item) =>
          item.id === itemId ? { ...item, done: !item.done } : item
        ),
        updatedAt: new Date().toISOString(),
      };
    }),
  }));

  get().scheduleSave();
}
```

---

### 대량 데이터 (Task 500개, Checklist 100개)
**달성 가능 여부**: ⚠️ 최적화 필수

**문제**:
- Task 500개 × 100개 항목 = 50,000개 데이터
- FlatList만으로는 부족할 수 있음
- 메모리 사용량 증가

**최적화 전략**:
1. **가상화 (Virtualization)**: ✅ FlatList 기본 지원
2. **페이지네이션**: TaskListScreen에서 20개씩 로드
3. **검색/필터**: Post-MVP → MVP로 변경 권장 (기획자도 지적)
4. **완료 Task 아카이브**: 30일 이상 된 완료 Task 자동 정리

```typescript
// ✅ 추가 권장: 가상 스크롤 + 페이지네이션 조합
function TaskListScreen() {
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const tasks = useTaskStore((state) => state.tasks);
  const displayedTasks = useMemo(() => {
    return tasks.slice(0, page * ITEMS_PER_PAGE);
  }, [tasks, page]);

  const loadMore = () => {
    if (displayedTasks.length < tasks.length) {
      setPage(page + 1);
    }
  };

  return (
    <FlatList
      data={displayedTasks}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      // ... 기타 최적화 props
    />
  );
}
```

---

## 🔄 기획자/디자이너 의견에 대한 기술 검토

### 기획자 제안

#### 1. Empty State에 예시 추가 + "예시 보기" 버튼
- **구현 가능**: ✅ 쉬움
- **난이도**: ⭐ (2시간)
- **기술적 고려사항**:
  ```typescript
  // src/data/examples.ts 추가 (tasks.md 2단계)
  export const EXAMPLE_TASKS: Task[] = [
    {
      id: 'example-1',
      title: '웹사이트 리뉴얼',
      items: [
        { id: 'ex-1-1', title: '디자인 시안 작성', done: false },
        { id: 'ex-1-2', title: '개발 환경 설정', done: false },
        { id: 'ex-1-3', title: '테스트 및 배포', done: false },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // TaskListScreen에서 활용
  function loadExamples() {
    EXAMPLE_TASKS.forEach((task) => addTask(task.title));
    // 첫 번째 예시 Task로 자동 이동
    navigation.navigate('TaskDetail', { taskId: 'example-1' });
  }
  ```

#### 2. Task 삭제 시 되돌리기 (3초 Toast)
- **구현 가능**: ✅ 중간
- **난이도**: ⭐⭐ (4시간)
- **기술적 고려사항**:
  - 라이브러리: `react-native-toast-message` 추천
  - Zustand에 `deletedTasks` 배열 추가 (임시 보관)
  - 3초 후 완전 삭제, 그 전에 undo 시 복원
  ```typescript
  // src/store/taskStore.ts
  interface TaskState {
    tasks: Task[];
    deletedTasks: Array<{ task: Task; deletedAt: number }>;

    deleteTask: (id: string) => void;
    undoDeleteTask: (id: string) => void;
  }

  const store = create<TaskState>((set, get) => ({
    deleteTask: (id: string) => {
      const task = get().tasks.find(t => t.id === id);
      if (!task) return;

      set((state) => ({
        tasks: state.tasks.filter(t => t.id !== id),
        deletedTasks: [
          ...state.deletedTasks,
          { task, deletedAt: Date.now() },
        ],
      }));

      // 3초 후 완전 삭제
      setTimeout(() => {
        set((state) => ({
          deletedTasks: state.deletedTasks.filter(d => d.task.id !== id),
        }));
      }, 3000);

      get().scheduleSave();
    },

    undoDeleteTask: (id: string) => {
      const deleted = get().deletedTasks.find(d => d.task.id === id);
      if (!deleted) return;

      set((state) => ({
        tasks: [...state.tasks, deleted.task],
        deletedTasks: state.deletedTasks.filter(d => d.task.id !== id),
      }));

      get().scheduleSave();
    },
  }));
  ```
- **우선순위**: P1 (MVP 강력 권장)

#### 3. 최대 개수 초과 시 안내 + 해결 방법
- **구현 가능**: ✅ 쉬움
- **난이도**: ⭐ (2시간)
- **제안**:
  ```typescript
  // src/store/taskStore.ts
  addTask: (title: string) => {
    const state = get();

    if (state.tasks.length >= MAX_TASKS) {
      // ✅ 에러 던지기 (UI에서 catch)
      throw new Error(
        `최대 ${MAX_TASKS}개 Task에 도달했습니다.\n` +
        `완료된 Task를 삭제하거나 보관하세요.`
      );
    }

    // ... 정상 로직
  };

  // TaskListScreen.tsx
  const handleAddTask = async () => {
    try {
      await addTask(title);
    } catch (error: any) {
      Alert.alert('할 일 추가 실패', error.message, [
        { text: '취소' },
        {
          text: '완료된 할 일 삭제',
          onPress: () => deleteCompletedTasks()
        },
      ]);
    }
  };
  ```

#### 4. 드래그 앤 드롭 순서 변경
- **구현 가능**: ⚠️ 어려움
- **난이도**: ⭐⭐⭐⭐ (12시간)
- **기술적 고려사항**:
  - 라이브러리: `react-native-draggable-flatlist` (8KB)
  - 접근성 문제: 스크린 리더 사용자는 드래그 불가
  - 대안: "위로/아래로" 버튼 제공 (난이도 ⭐⭐, 4시간)
- **권장**: Post-MVP로 유지, 대신 버튼 방식 MVP 포함

#### 5. 데이터 백업/복원 (JSON 내보내기/가져오기)
- **구현 가능**: ✅ 중간
- **난이도**: ⭐⭐⭐ (8시간)
- **기술적 고려사항**:
  - 라이브러리: `react-native-fs` (파일 저장)
  - iOS/Android 권한 처리 필요
  - 공유 시트: `react-native-share` 활용
  ```typescript
  // src/services/backup.ts
  import RNFS from 'react-native-fs';
  import Share from 'react-native-share';

  export async function exportData(data: AppData): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    const filename = `split-todo-backup-${Date.now()}.json`;
    const path = `${RNFS.DocumentDirectoryPath}/${filename}`;

    await RNFS.writeFile(path, json, 'utf8');

    await Share.open({
      url: `file://${path}`,
      type: 'application/json',
      title: 'Split TODO 백업',
    });
  }

  export async function importData(filePath: string): Promise<AppData> {
    const json = await RNFS.readFile(filePath, 'utf8');
    const data = JSON.parse(json);

    // ✅ 검증
    if (!data.schemaVersion || !Array.isArray(data.tasks)) {
      throw new Error('잘못된 백업 파일입니다.');
    }

    return data;
  }
  ```
- **우선순위**: P1 (MVP 강력 권장, 오프라인 앱 필수)

#### 6. 간단한 검색 기능 (Task 20개 이상일 때)
- **구현 가능**: ✅ 쉬움
- **난이도**: ⭐⭐ (4시간)
- **제안**:
  ```typescript
  // TaskListScreen.tsx
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;

    return tasks.filter((task) =>
      task.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tasks, searchQuery]);

  return (
    <View>
      {tasks.length >= 20 && (
        <TextInput
          placeholder="할 일 검색"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      )}
      <FlatList data={filteredTasks} ... />
    </View>
  );
  ```
- **우선순위**: P1 (MVP 권장, 기획자도 지적)

---

### 디자이너 제안

#### 1. 색상 대비 개선 (Success Green, Danger Red 등)
- **구현 가능**: ✅ 매우 쉬움
- **난이도**: ⭐ (30분)
- **기술적 고려사항**: 색상 코드만 변경하면 됨
  ```typescript
  // src/styles/colors.ts
  export const colors = {
    // ❌ Before
    // success: '#10b981', // 대비율 2.8:1
    // danger: '#ef4444',  // 대비율 3.9:1

    // ✅ After (WCAG AA 통과)
    success: '#059669', // 대비율 4.5:1
    danger: '#dc2626',  // 대비율 5.5:1
    textSecondary: '#4b5563', // 대비율 7:1
  };
  ```
- **우선순위**: P0 (MVP 필수, 접근성)

#### 2. 터치 영역 44x44pt 보장
- **구현 가능**: ✅ 쉬움
- **난이도**: ⭐ (1시간)
- **기술적 고려사항**:
  ```typescript
  // src/components/ChecklistItemView.tsx
  <TouchableOpacity
    onPress={onToggle}
    style={styles.checkboxTouchArea} // ✅ 44x44pt
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  >
    <Icon name="checkbox" size={24} />
  </TouchableOpacity>

  const styles = StyleSheet.create({
    checkboxTouchArea: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
  ```
- **우선순위**: P0 (MVP 필수, 접근성)

#### 3. accessibilityLabel 추가
- **구현 가능**: ✅ 중간
- **난이도**: ⭐⭐ (3시간)
- **기술적 고려사항**:
  - 모든 인터랙티브 요소에 추가 필요
  - 동적 레이블 (예: "3/5 완료" → "5개 중 3개 완료")
  ```typescript
  // TaskCard.tsx
  <TouchableOpacity
    accessibilityLabel={`${task.title}, ${progress.done}개 중 ${progress.total}개 완료, ${progress.percent}퍼센트`}
    accessibilityHint="탭하여 세부 단계 보기"
    accessibilityRole="button"
  >
    ...
  </TouchableOpacity>

  // ChecklistItemView.tsx
  <TouchableOpacity
    accessibilityLabel={`${item.title}, ${item.done ? '완료됨' : '미완료'}`}
    accessibilityHint="탭하여 완료 상태 전환"
    accessibilityRole="checkbox"
    accessibilityState={{ checked: item.done }}
  >
    ...
  </TouchableOpacity>
  ```
- **우선순위**: P0 (MVP 필수, 접근성)

#### 4. 타이포그래피 줄 간격 정의
- **구현 가능**: ✅ 매우 쉬움
- **난이도**: ⭐ (30분)
- **제안**:
  ```typescript
  // src/styles/typography.ts
  export const typography = {
    h1: { fontSize: 28, fontWeight: '700', lineHeight: 36 },
    h2: { fontSize: 24, fontWeight: '600', lineHeight: 32 },
    body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
    caption: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  };
  ```

#### 5. 진행률 바 애니메이션
- **구현 가능**: ✅ 중간
- **난이도**: ⭐⭐⭐ (6시간)
- **기술적 고려사항**:
  - 라이브러리: `react-native-reanimated` (이미 Expo 포함)
  ```typescript
  import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

  function ProgressBar({ percent }: { percent: number }) {
    const animatedStyle = useAnimatedStyle(() => ({
      width: withTiming(`${percent}%`, { duration: 300 }),
    }));

    return (
      <View style={styles.container}>
        <Animated.View style={[styles.fill, animatedStyle]} />
      </View>
    );
  }
  ```
- **우선순위**: P2 (시간 있으면 포함)

#### 6. 햅틱 피드백
- **구현 가능**: ✅ 매우 쉬움
- **난이도**: ⭐ (1시간)
- **기술적 고려사항**:
  - Expo: `expo-haptics` (기본 포함)
  ```typescript
  import * as Haptics from 'expo-haptics';

  function toggleChecklistItem() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // ... toggle 로직
  }

  function completeTask() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // ... complete 로직
  }
  ```
- **우선순위**: P1 (MVP 권장, 구현 간단)

#### 7. 완료 축하 애니메이션 (confetti)
- **구현 가능**: ⚠️ 어려움
- **난이도**: ⭐⭐⭐⭐ (12시간)
- **기술적 고려사항**:
  - 라이브러리: `react-native-confetti-cannon` (성능 이슈 있음)
  - 대안: Lottie 애니메이션 (더 가벼움)
- **권장**: Post-MVP로 유지

---

## 💡 기술적 개선 제안

### 1. 코드 구조 개선
**현재**: tasks.md에 `src/` 디렉터리 구조 정의됨
```
src/
├── types/
├── store/
├── services/
├── utils/
├── screens/
└── components/
```

**제안**: 기능별 그룹핑 추가
```
src/
├── features/          # ✅ 추가 권장
│   ├── tasks/
│   │   ├── TaskListScreen.tsx
│   │   ├── TaskDetailScreen.tsx
│   │   ├── TaskCard.tsx
│   │   └── taskStore.ts
│   └── settings/
│       └── SettingsScreen.tsx
├── shared/            # ✅ 공통 모듈
│   ├── components/
│   │   ├── Button.tsx
│   │   └── Input.tsx
│   ├── utils/
│   └── types/
└── services/
    ├── storage.ts
    └── backup.ts
```

**장점**:
- 기능별로 코드 응집도 향상
- 팀 협업 시 충돌 감소
- 테스트 코드 작성 용이

---

### 2. 테스트 전략 구체화
**현재**: tasks.md 11단계에 단위 테스트만 명시

**제안**: 테스트 피라미드 적용
```
┌─────────────────┐
│  E2E (10%)      │  Detox (느림, 1-2개 핵심 플로우만)
├─────────────────┤
│ Integration(30%)│  React Native Testing Library
├─────────────────┤
│  Unit (60%)     │  Jest (빠름, 많이 작성)
└─────────────────┘
```

**우선순위**:
```typescript
// P0 (MVP 필수):
describe('taskStore', () => {
  test('addTask: 새 Task 추가', () => { ... });
  test('toggleChecklistItem: 체크 상태 전환', () => { ... });
  test('deleteTask: Task 삭제', () => { ... });
});

describe('storage', () => {
  test('saveAppData: 저장 성공', () => { ... });
  test('saveAppData: 저장 실패 시 1회 재시도', () => { ... });
  test('loadAppData: 스키마 마이그레이션', () => { ... });
});

// P1 (MVP 권장):
describe('TaskListScreen', () => {
  test('Task 추가 버튼 클릭 시 모달 열림', () => { ... });
  test('Task 카드 클릭 시 상세 화면 이동', () => { ... });
});

// P2 (Post-MVP):
describe('E2E', () => {
  test('Task 생성 → Checklist 추가 → 완료 플로우', () => { ... });
});
```

---

### 3. 에러 바운더리 추가
**문제**: 앱 크래시 시 사용자에게 빈 화면만 표시

**제안**:
```typescript
// src/components/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';
import { View, Text, Button } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    // ✅ 선택: Sentry 같은 에러 트래킹 서비스로 전송
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
          <Text style={{ fontSize: 20, marginBottom: 16 }}>
            문제가 발생했습니다
          </Text>
          <Text style={{ marginBottom: 20 }}>
            앱을 다시 시작해주세요. 문제가 지속되면 데이터를 백업하세요.
          </Text>
          <Button
            title="앱 다시 시작"
            onPress={() => this.setState({ hasError: false })}
          />
        </View>
      );
    }

    return this.props.children;
  }
}

// App.tsx에서 사용
function App() {
  return (
    <ErrorBoundary>
      <NavigationContainer>
        ...
      </NavigationContainer>
    </ErrorBoundary>
  );
}
```

---

### 4. 로깅 및 디버깅 도구
**제안**:
```typescript
// src/utils/logger.ts
export const logger = {
  debug: (message: string, data?: any) => {
    if (__DEV__) {
      console.log(`[DEBUG] ${message}`, data);
    }
  },

  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error);
    // ✅ 프로덕션에서는 Sentry로 전송
  },

  performance: (label: string, startTime: number) => {
    const duration = performance.now() - startTime;
    console.log(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
  },
};

// 사용 예시
async function saveAppData(data: AppData) {
  const start = performance.now();

  try {
    await AsyncStorage.setItem('APP_DATA', JSON.stringify(data));
    logger.performance('saveAppData', start);
  } catch (error) {
    logger.error('saveAppData failed', error);
    throw error;
  }
}
```

---

### 5. TypeScript 타입 가드 추가
**문제**: AsyncStorage에서 읽은 데이터가 예상 형태가 아닐 수 있음

**제안**:
```typescript
// src/utils/validation.ts
export function isValidTask(obj: any): obj is Task {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    Array.isArray(obj.items) &&
    obj.items.every(isValidChecklistItem) &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string'
  );
}

export function isValidChecklistItem(obj: any): obj is ChecklistItem {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.done === 'boolean'
  );
}

export function isValidAppData(obj: any): obj is AppData {
  return (
    typeof obj === 'object' &&
    typeof obj.schemaVersion === 'number' &&
    Array.isArray(obj.tasks) &&
    obj.tasks.every(isValidTask)
  );
}

// src/services/storage.ts에서 사용
async function loadAppData(): Promise<AppData> {
  const raw = await AsyncStorage.getItem('APP_DATA');
  if (!raw) return createEmptyData();

  const data = JSON.parse(raw);

  // ✅ 타입 가드로 검증
  if (!isValidAppData(data)) {
    logger.error('Invalid data format, loading from backup');
    // 백업에서 복구 시도
    const backupRaw = await AsyncStorage.getItem('APP_DATA_BACKUP');
    if (backupRaw) {
      const backupData = JSON.parse(backupRaw);
      if (isValidAppData(backupData)) {
        return backupData;
      }
    }
    // 둘 다 실패하면 빈 데이터
    return createEmptyData();
  }

  return data;
}
```

---

### 6. 개발 도구 설정 강화
**tasks.md 1단계 보완**:
```json
// package.json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "validate": "npm run lint && npm run type-check && npm run test"
  },
  "husky": {
    "hooks": {
      "pre-commit": "npm run validate"
    }
  }
}

// .eslintrc.js
module.exports = {
  extends: [
    '@react-native-community',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // ✅ 접근성 강제
    'react-native/no-inline-styles': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
```

---

## 📋 tasks.md 수정 요청

### 즉시 추가 필요 (Critical)

#### 1단계: 패키지 설치에 추가
```markdown
- [ ] 필요한 패키지 설치
  - [ ] @react-native-community/netinfo (오프라인 감지, 선택)
  - [ ] react-native-toast-message (되돌리기 Toast)
  - [ ] expo-haptics (햅틱 피드백)
  - [ ] lodash (debounce 유틸)
  - [ ] react-native-fs (파일 저장, 백업용)
  - [ ] react-native-share (백업 공유)
```

#### 2단계: 데이터 모델에 추가
```markdown
- [ ] 타입 정의 작성
  - [ ] DeletedTask 인터페이스 (id, task, deletedAt) - 되돌리기용
  - [ ] AppError 클래스 (code, message) - 에러 처리용
  - [ ] BackupMetadata 인터페이스 (version, createdAt, deviceInfo)
```

#### 3단계: 유틸리티 함수 보완
```markdown
- [ ] 유틸리티 함수 구현
  - [ ] calculateStorageSize() - 저장 크기 측정
  - [ ] isValidAppData() - 타입 가드
  - [ ] getUserFriendlyMessage() - 에러 메시지 변환
  - [ ] logger (debug, error, performance)
```

#### 4단계: 로컬 저장소 보완
```markdown
- [ ] AsyncStorage 저장소 서비스
  - [ ] migrateSchema() - 스키마 마이그레이션 구체화
  - [ ] cleanOldCompletedTasks() - 자동 정리 함수
  - [ ] 저장 크기 검증 (5MB 제한)
  - [ ] 타입 가드로 데이터 검증
```

#### 5단계: 상태 관리 보완
```markdown
- [ ] Task Store 구현
  - [ ] deletedTasks 상태 추가 (되돌리기용)
  - [ ] undoDeleteTask() 액션 추가
  - [ ] saveImmediately() 액션 추가 (앱 백그라운드 시)
  - [ ] AppState listener 추가 (자동 저장)
  - [ ] scheduleSave() debounce 구현 명시
  - [ ] 최대 개수 초과 시 에러 처리
```

#### 6단계: UI 컴포넌트 보완
```markdown
- [ ] 공통 컴포넌트 추가
  - [ ] Button 컴포넌트 (accessibilityLabel 포함)
  - [ ] Input 컴포넌트 (글자 수 카운터)
  - [ ] Toast 컴포넌트 (되돌리기용)
  - [ ] ErrorBoundary 컴포넌트
```

#### 7단계: 화면 개발 보완
```markdown
- [ ] TaskListScreen
  - [ ] 검색 기능 (Task 20개 이상 시 표시)
  - [ ] 페이지네이션 (20개씩 로드)
  - [ ] "예시 보기" 버튼 (Empty State)
  - [ ] FlatList 최적화 props 추가
  - [ ] 완료 Task 섹션 분리

- [ ] TaskDetailScreen
  - [ ] 햅틱 피드백 (체크박스 토글)
  - [ ] 롱프레스로 편집 모드 진입 (인라인 편집)
  - [ ] 완료 축하 모달 (100% 도달 시, Post-MVP)

- [ ] SettingsScreen 추가 (신규)
  - [ ] 데이터 내보내기 버튼
  - [ ] 데이터 가져오기 버튼
  - [ ] 앱 정보 (버전, 라이선스)
```

#### 8단계: App 통합 보완
```markdown
- [ ] App.tsx 구현
  - [ ] ErrorBoundary로 감싸기
  - [ ] 성능 측정 (초기 로딩 시간)
  - [ ] react-native-get-random-values import 최상단 추가
```

#### 11단계: 테스트 보완
```markdown
- [ ] 단위 테스트 작성
  - [ ] calculateStorageSize() 테스트
  - [ ] migrateSchema() 테스트 (v1→v2)
  - [ ] isValidAppData() 타입 가드 테스트
  - [ ] undoDeleteTask() 테스트

- [ ] 통합 테스트
  - [ ] 앱 백그라운드 시 즉시 저장 테스트
  - [ ] 저장 크기 초과 시 자동 정리 테스트
```

#### 12단계: 성능 최적화 보완
```markdown
- [ ] 성능 최적화
  - [ ] useMemo로 진행률 계산 캐싱
  - [ ] React.memo로 컴포넌트 리렌더 방지
  - [ ] FlatList getItemLayout 구현
  - [ ] 초기 로딩 시간 측정 및 로깅
```

---

### 우선순위 조정 제안

#### Critical Path (P0 - MVP 필수):
```
1단계 → 2단계 → 3단계 → 4단계 (보완) → 5단계 (보완) →
6단계 (기본 컴포넌트) → 7단계 (기본 화면) → 8단계 →
9단계 (iOS/Android) → 10단계 (접근성 통합) → 11단계 (핵심 테스트) →
12단계 (성능 측정) → 13단계
```

#### Secondary Path (P1 - MVP 강력 권장):
```
6단계 (Toast, ErrorBoundary) → 7단계 (검색, 되돌리기, 설정 화면) →
11단계 (통합 테스트)
```

#### Post-MVP:
```
- 드래그 앤 드롭
- 완료 축하 애니메이션
- 다크 모드 토글
- E2E 테스트
```

---

### 누락된 단계 추가

#### 신규 단계 (4.5): 백업/복원 서비스
```markdown
## 4.5단계: 백업 및 복원 서비스
- [ ] 백업 서비스 (src/services/backup.ts)
  - [ ] exportData() - JSON 파일로 내보내기
  - [ ] importData() - JSON 파일에서 가져오기
  - [ ] validateBackupFile() - 백업 파일 검증
  - [ ] 공유 시트로 파일 공유 (react-native-share)
```

#### 신규 단계 (7.5): 설정 화면
```markdown
## 7.5단계: 설정 및 유틸리티 화면
- [ ] SettingsScreen (src/screens/SettingsScreen.tsx)
  - [ ] 데이터 관리 섹션
    - [ ] "데이터 내보내기" 버튼
    - [ ] "데이터 가져오기" 버튼
    - [ ] "완료된 할 일 삭제" 버튼
  - [ ] 앱 정보 섹션
    - [ ] 버전 표시
    - [ ] 라이선스 정보
    - [ ] 저장 공간 사용량 표시
  - [ ] 접근성 섹션
    - [ ] 햅틱 피드백 on/off 토글
```

---

## 📅 개발 일정 제안

### Phase 1: 기반 구축 (1주)
- 1-4단계: 프로젝트 셋업, 데이터 모델, 저장소
- **산출물**: 데이터 저장/로드 가능

### Phase 2: 핵심 기능 (2주)
- 5-7단계: 상태 관리, UI 컴포넌트, 화면
- **산출물**: Task 추가, Checklist 관리 가능

### Phase 3: 안정화 (1주)
- 8-10단계: 통합, 접근성, 플랫폼 대응
- **산출물**: iOS/Android 모두 정상 작동

### Phase 4: 최적화 (1주)
- 11-12단계: 테스트, 성능 최적화
- **산출물**: 500ms 로딩, 100ms 반응 달성

### Phase 5: 마무리 (1주)
- 13단계: 버그 수정, 문서화, 빌드
- **산출물**: MVP 출시 준비 완료

**총 개발 기간**: 6주 (1명 풀타임 기준)

---

## 🎯 최종 평가

### 강점 (계속 유지)
1. **명확한 MVP 범위**: 오프라인 TODO 앱의 핵심에 집중
2. **적절한 기술 스택**: React Native + Zustand + AsyncStorage
3. **체계적인 작업 분해**: 13단계로 명확하게 구조화
4. **접근성 고려**: 초기부터 WCAG AA 기준 명시
5. **확장 가능한 설계**: schemaVersion으로 마이그레이션 대비

### 개선 영역 (즉시 보완)
1. **AsyncStorage 용량 제한**: 현실적인 제한 (200개 Task, 50개 항목)
2. **동시성 문제**: 앱 백그라운드 시 즉시 저장
3. **스키마 마이그레이션**: 구체적인 구현 코드 추가
4. **에러 처리**: 타입별 에러 메시지 및 복구 전략
5. **인라인 편집 UX**: 롱프레스 또는 명시적 버튼으로 개선
6. **백업/복원 기능**: 오프라인 앱의 필수 기능

### 위험 요소 (주의 필요)
1. **대량 데이터 성능**: 500개 Task는 최적화 필수
2. **디자이너 제안 과다**: 일부는 Post-MVP로 조정
3. **테스트 부족**: 통합 테스트 및 E2E 추가 권장
4. **에러 바운더리 없음**: 앱 크래시 대응 필요

---

## 📊 기술 스택 최종 평가

| 기술 | 평가 | 이유 |
|------|------|------|
| React Native + Expo | ✅ 최적 | 빠른 개발, 크로스 플랫폼 |
| TypeScript | ✅ 최적 | 타입 안전성, 유지보수성 |
| Zustand | ✅ 적합 | 가볍고 간단, debounce 구현 용이 |
| AsyncStorage | ⚠️ 주의 | 용량 제한 고려 필요 (6-10MB) |
| React Navigation | ✅ 적합 | Stack Navigator로 충분 |
| UUID | ✅ 적합 | 고유 ID 생성, 충돌 없음 |

---

## 🚀 출시 준비 체크리스트

### MVP 출시 전 필수 항목
- [ ] AsyncStorage 용량 제한 구현 (5MB)
- [ ] 앱 백그라운드 시 즉시 저장
- [ ] 스키마 마이그레이션 구현
- [ ] 타입 가드로 데이터 검증
- [ ] 에러 바운더리 추가
- [ ] accessibilityLabel 모든 인터랙티브 요소에 추가
- [ ] 색상 대비 WCAG AA 통과 (Success Green, Danger Red)
- [ ] 터치 영역 44x44pt 보장
- [ ] 초기 로딩 500ms 달성
- [ ] UI 반응 100ms 달성
- [ ] 되돌리기 기능 (Toast)
- [ ] 백업/복원 기능 (JSON 내보내기/가져오기)
- [ ] 검색 기능 (Task 20개 이상 시)
- [ ] 최대 개수 초과 시 안내 메시지
- [ ] iOS/Android 실기 테스트
- [ ] VoiceOver/TalkBack 테스트

### MVP 출시 후 우선 추가
- [ ] 간단한 통계 (완료율)
- [ ] 다크 모드 (시스템 설정 따라가기)
- [ ] 드래그 앤 드롭 순서 변경
- [ ] 완료 축하 애니메이션
- [ ] Sentry 에러 트래킹

---

**검토 완료일**: 2025-11-06
**검토자**: Senior React Native Developer
**권장 조치**: Critical 항목 즉시 반영 후 개발 시작
**다음 리뷰**: 2주차 코드 리뷰 (기반 구축 완료 후)
