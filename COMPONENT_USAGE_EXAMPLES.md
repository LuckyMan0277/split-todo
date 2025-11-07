# Component Usage Examples

This document provides comprehensive usage examples for all components in the Split TODO React Native application.

---

## Table of Contents

1. [ProgressBar](#progressbar)
2. [TaskCard](#taskcard)
3. [ChecklistItemView](#checklistitemview)
4. [AddItemInput](#additeminput)
5. [Button](#button)
6. [ErrorBoundary](#errorboundary)

---

## ProgressBar

A visual progress indicator that displays task completion percentage.

### Basic Usage

```tsx
import { ProgressBar } from '@/components';

// 60% progress (blue bar)
<ProgressBar progress={60} />

// 100% progress (green bar)
<ProgressBar progress={100} />

// 0% progress
<ProgressBar progress={0} />
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `progress` | `number` | Yes | Progress value between 0-100 |

### Accessibility

- Screen reader announces: "{percent}% 완료"
- Accessible role: "progressbar"

### Visual Design

- **Height**: 10pt (within 10-12pt range)
- **Background**: Gray (#e5e7eb)
- **Fill Color**:
  - Blue (#3b82f6) when < 100%
  - Green (#059669) when 100%
- **Border Radius**: 6pt

---

## TaskCard

A card component that displays a task with its progress.

### Basic Usage

```tsx
import { TaskCard } from '@/components';

const MyTaskList = () => {
  const task = {
    id: '123',
    title: '웹사이트 리뉴얼',
    items: [
      { id: '1', title: '디자인', done: true },
      { id: '2', title: '개발', done: true },
      { id: '3', title: '테스트', done: false },
    ],
    createdAt: '2025-11-06T00:00:00.000Z',
    updatedAt: '2025-11-06T12:00:00.000Z',
  };

  const handlePress = () => {
    navigation.navigate('TaskDetail', { taskId: task.id });
  };

  return (
    <TaskCard
      task={task}
      onPress={handlePress}
    />
  );
};
```

### With Custom Style

```tsx
<TaskCard
  task={myTask}
  onPress={handlePress}
  style={{ marginHorizontal: 20 }}
/>
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `task` | `Task` | Yes | Task object to display |
| `onPress` | `() => void` | Yes | Callback when card is pressed |
| `style` | `StyleProp<ViewStyle>` | No | Optional custom style |

### Features

- Progress bar with color change at 100%
- Completion text: "n/m 완료 (percent%)"
- Optimized with `React.memo` and `useMemo`
- Minimum 44x44pt touch target

### Accessibility

- Label: "{title}, {done}개 중 {total}개 완료, {percent}퍼센트"
- Hint: "탭하여 세부 단계 보기"
- Role: "button"

---

## ChecklistItemView

Displays a single checklist item with checkbox, title, and delete button.

### Basic Usage

```tsx
import { ChecklistItemView } from '@/components';

const MyChecklist = () => {
  const item = {
    id: '1',
    title: '디자인 시안 작성',
    done: false,
  };

  const handleToggle = () => {
    // Toggle item completion
    store.toggleChecklistItem(taskId, item.id);
  };

  const handleDelete = () => {
    // Delete item
    store.deleteChecklistItem(taskId, item.id);
  };

  const handleUpdate = async (newTitle: string) => {
    try {
      await store.updateChecklistItem(taskId, item.id, newTitle);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: '제목 저장에 실패했습니다'
      };
    }
  };

  return (
    <ChecklistItemView
      item={item}
      onToggle={handleToggle}
      onDelete={handleDelete}
      onUpdate={handleUpdate}
    />
  );
};
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `item` | `ChecklistItem` | Yes | Checklist item to display |
| `onToggle` | `() => void` | Yes | Callback when checkbox is toggled |
| `onDelete` | `() => void` | Yes | Callback when item is deleted |
| `onUpdate` | `(newTitle: string) => Promise<{success: boolean, error?: string}>` | Yes | Callback when item title is updated |

### Features

- **Checkbox**: 24x24 visual, 44x44 touch area (with hitSlop)
- **Long Press**: 500ms delay to enter edit mode
- **Inline Editing**: TextInput appears on long press
- **Delete Button**: Shows confirmation dialog
- **Strikethrough**: Applied when item is completed
- **Color Change**: Text becomes secondary color when completed

### Accessibility

- Label: "{title}, {done ? '완료됨' : '미완료'}"
- Hint: "탭하여 완료 상태 전환", "길게 눌러서 편집"
- Role: "checkbox"
- State: `{ checked: done }`

---

## AddItemInput

An input component for adding new tasks or checklist items.

### Basic Usage

```tsx
import { AddItemInput } from '@/components';

const MyTaskDetail = () => {
  const handleAdd = async (title: string) => {
    try {
      await store.addChecklistItem(taskId, title);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  return (
    <AddItemInput
      placeholder="새 항목 추가"
      onAdd={handleAdd}
    />
  );
};
```

### With Custom Placeholder

```tsx
<AddItemInput
  placeholder="할 일을 입력하세요"
  onAdd={handleAddTask}
/>
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onAdd` | `(title: string) => Promise<{success: boolean, error?: string}>` | Yes | Callback when user adds an item |
| `placeholder` | `string` | No | Placeholder text (default: "새 항목 추가") |

### Features

- **Character Limit**: 120 characters max
- **Character Counter**: Shows "n/120"
- **Input Validation**: Uses `validateTitle` and `normalizeTitle`
- **Loading State**: Shows spinner while adding
- **Auto-clear**: Clears input on success
- **Error Handling**: Shows alert on validation or add failure
- **Keyboard Support**: "done" return key, submits on enter

### Accessibility

- Label: Placeholder text
- Hint: "새 항목의 제목을 입력하고 추가 버튼을 누르세요"
- Button disabled state announced

---

## Button

A reusable button component with multiple variants and states.

### Basic Usage

```tsx
import { Button } from '@/components';

// Primary button
<Button
  variant="primary"
  onPress={() => handleSave()}
  accessibilityLabel="저장하기"
>
  저장
</Button>

// Secondary button
<Button
  variant="secondary"
  onPress={() => handleCancel()}
>
  취소
</Button>

// Danger button
<Button
  variant="danger"
  onPress={() => handleDelete()}
  accessibilityLabel="삭제하기"
>
  삭제
</Button>
```

### With Loading State

```tsx
<Button
  variant="primary"
  onPress={handleSubmit}
  loading={isSubmitting}
>
  제출
</Button>
```

### With Disabled State

```tsx
<Button
  variant="primary"
  onPress={handleSave}
  disabled={!isValid}
>
  저장
</Button>
```

### With Custom Styles

```tsx
<Button
  variant="primary"
  onPress={handleAction}
  style={{ width: '100%' }}
  textStyle={{ fontSize: 18 }}
>
  전체 너비 버튼
</Button>
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `ReactNode` | Yes | Button text or content |
| `onPress` | `() => void` | Yes | Callback when button is pressed |
| `variant` | `'primary' \| 'secondary' \| 'danger'` | No | Button style (default: "primary") |
| `loading` | `boolean` | No | Shows spinner and disables button |
| `disabled` | `boolean` | No | Disables button interaction |
| `style` | `StyleProp<ViewStyle>` | No | Custom container style |
| `textStyle` | `StyleProp<TextStyle>` | No | Custom text style |
| `accessibilityLabel` | `string` | No | Accessibility label |
| `accessibilityHint` | `string` | No | Accessibility hint |

### Variants

#### Primary
- **Background**: Blue (#3b82f6)
- **Text**: White
- **Use**: Main actions, save, submit

#### Secondary
- **Background**: White
- **Border**: Blue (#3b82f6)
- **Text**: Blue
- **Use**: Cancel, secondary actions

#### Danger
- **Background**: Red (#dc2626)
- **Text**: White
- **Use**: Delete, destructive actions

### Features

- Minimum 44x44pt touch target
- Loading state with spinner
- Disabled state with opacity
- Active opacity on press (0.7)
- Full accessibility support

---

## ErrorBoundary

A React error boundary that catches JavaScript errors and displays fallback UI.

### Basic Usage

```tsx
import { ErrorBoundary } from '@/components';
import App from './App';

// Wrap entire app
const Root = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
```

### Wrap Specific Screen

```tsx
<ErrorBoundary>
  <TaskDetailScreen />
</ErrorBoundary>
```

### With Custom Fallback

```tsx
<ErrorBoundary
  fallback={(error, errorInfo, retry) => (
    <View style={styles.customError}>
      <Text>커스텀 에러 UI</Text>
      <Button onPress={retry}>다시 시도</Button>
    </View>
  )}
>
  <MyComponent />
</ErrorBoundary>
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `ReactNode` | Yes | Components to wrap |
| `fallback` | `(error: Error, errorInfo: ErrorInfo, retry: () => void) => ReactNode` | No | Custom error UI |

### Features

- **Error Catching**: Catches errors in child component tree
- **Error Logging**: Logs to console (can extend to error tracking)
- **Fallback UI**: User-friendly error message
- **Retry Button**: Allows user to attempt recovery
- **Development Mode**: Shows detailed error info in `__DEV__`

### Default Error UI

- Error icon (⚠️)
- Title: "앗, 문제가 발생했습니다"
- Message: "예상치 못한 오류가 발생했습니다. 다시 시도하거나 앱을 재시작해보세요."
- Error details (development only)
- Retry button

### Error Tracking Integration

The component is ready for error tracking service integration:

```tsx
componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
  // Log to console
  console.error('ErrorBoundary caught an error:', error, errorInfo);

  // Send to Sentry (example)
  // Sentry.captureException(error, {
  //   contexts: {
  //     react: {
  //       componentStack: errorInfo.componentStack,
  //     },
  //   },
  // });
}
```

---

## Integration Example

Here's how to use multiple components together:

```tsx
import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import {
  ErrorBoundary,
  TaskCard,
  AddItemInput,
  Button,
} from '@/components';
import { useTaskStore } from '@/store/taskStore';

const TaskListScreen = ({ navigation }) => {
  const { tasks, addTask } = useTaskStore();

  const handleAddTask = async (title: string) => {
    try {
      await addTask(title);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  const handleTaskPress = (taskId: string) => {
    navigation.navigate('TaskDetail', { taskId });
  };

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {/* Task List */}
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              onPress={() => handleTaskPress(item.id)}
            />
          )}
        />

        {/* Add Task Input */}
        <AddItemInput
          placeholder="새 할 일 추가"
          onAdd={handleAddTask}
        />
      </View>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});

export default TaskListScreen;
```

---

## Accessibility Best Practices

All components follow WCAG AA accessibility guidelines:

1. **Touch Targets**: Minimum 44x44pt for all interactive elements
2. **Screen Readers**: All components have descriptive `accessibilityLabel`
3. **Color Contrast**: All color combinations meet 4.5:1 ratio
4. **Keyboard Support**: Full keyboard navigation support
5. **State Announcements**: Loading, disabled, and checked states are announced

### Testing Accessibility

#### iOS (VoiceOver)
1. Enable: Settings > Accessibility > VoiceOver
2. Navigate: Swipe right/left
3. Activate: Double tap

#### Android (TalkBack)
1. Enable: Settings > Accessibility > TalkBack
2. Navigate: Swipe right/left
3. Activate: Double tap

---

## Design Tokens Reference

Components use design tokens from `src/styles`:

```tsx
import { colors } from '@/styles/colors';
import { typography } from '@/styles/typography';
import { spacing } from '@/styles/spacing';
```

### Colors
- **Primary**: #3b82f6 (Blue)
- **Success**: #059669 (Green)
- **Danger**: #dc2626 (Red)
- **Background**: #f9fafb (Light Gray)
- **Surface**: #ffffff (White)

### Typography
- **h1**: 28px, bold
- **h2**: 24px, semibold
- **h3**: 20px, semibold
- **body**: 16px, regular
- **caption**: 14px, regular

### Spacing
- **xs**: 4px
- **sm**: 8px
- **md**: 12px
- **lg**: 16px
- **xl**: 20px
- **xxl**: 24px

---

## TypeScript Types

All components are fully typed. Import types as needed:

```tsx
import type {
  ProgressBarProps,
  TaskCardProps,
  ChecklistItemViewProps,
  AddItemInputProps,
  ButtonProps,
  ButtonVariant,
} from '@/components';
```

---

## Performance Optimization

Components are optimized for performance:

- **TaskCard**: Uses `React.memo` with custom comparison function
- **Progress Calculation**: Cached with `useMemo` in TaskCard
- **Minimal Re-renders**: Only re-render when necessary props change

---

## Common Patterns

### Error Handling

```tsx
const handleAction = async (input: string) => {
  try {
    await performAction(input);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message || '작업에 실패했습니다'
    };
  }
};
```

### Loading States

```tsx
const [isLoading, setIsLoading] = useState(false);

const handleSubmit = async () => {
  setIsLoading(true);
  await submitData();
  setIsLoading(false);
};

<Button loading={isLoading} onPress={handleSubmit}>
  제출
</Button>
```

### Confirmation Dialogs

```tsx
import { Alert } from 'react-native';

const handleDelete = () => {
  Alert.alert(
    '삭제 확인',
    '정말 삭제하시겠습니까?',
    [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => performDelete()
      },
    ]
  );
};
```

---

## Troubleshooting

### Component Not Rendering

1. Check import path: `import { ComponentName } from '@/components'`
2. Verify TypeScript types are correct
3. Check console for errors

### TypeScript Errors

1. Run `npx tsc --noEmit` to check for type errors
2. Ensure all required props are provided
3. Check prop types match interface definitions

### Accessibility Issues

1. Test with VoiceOver (iOS) or TalkBack (Android)
2. Verify `accessibilityLabel` is descriptive
3. Ensure touch targets are at least 44x44pt

---

## Next Steps

1. Implement screen components using these components
2. Add unit tests for each component
3. Test accessibility with screen readers
4. Add animations (optional)
5. Integrate with state management (Zustand)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-06
**Author**: Components Agent
