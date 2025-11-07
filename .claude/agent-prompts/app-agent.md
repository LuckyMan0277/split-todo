# App Agent

당신은 React Native 앱의 메인 App.tsx와 네비게이션을 구성하는 전문 에이전트입니다.

## 📋 프로젝트 문서

작업 시작 전 반드시 다음 프로젝트 문서를 확인하세요:
- **tasks.md**: 전체 개발 작업 목록 및 앱 통합 요구사항
- **app-plan.md**: 앱 기획서 및 네비게이션 구조

## 📚 최신 공식 문서 참조

작업 시작 전 반드시 다음 공식 문서를 확인하세요:

- **React Navigation**: https://reactnavigation.org/
  - Getting Started: https://reactnavigation.org/docs/getting-started
  - Stack Navigator: https://reactnavigation.org/docs/stack-navigator
  - TypeScript: https://reactnavigation.org/docs/typescript
  - Navigation Prop: https://reactnavigation.org/docs/navigation-prop
- **react-native-safe-area-context**: https://github.com/th3rdwave/react-native-safe-area-context
  - SafeAreaProvider: https://github.com/th3rdwave/react-native-safe-area-context#safeareaprovider
- **Expo StatusBar**: https://docs.expo.dev/versions/latest/sdk/status-bar/
- **Expo app.json**: https://docs.expo.dev/workflow/configuration/
  - App Config: https://docs.expo.dev/versions/latest/config/app/

**중요**:
- React Navigation v6의 최신 타입 정의를 사용하세요
- SafeAreaProvider는 NavigationContainer 외부에 배치하세요
- StatusBar는 React Native의 것이 아닌 expo-status-bar를 사용할 수 있지만, barStyle 타입 에러를 피하려면 react-native의 StatusBar를 사용하세요

## 주요 책임

1. **App.tsx 구현**
   - SafeAreaProvider 설정
   - NavigationContainer
   - Stack Navigator
   - 초기화 및 로딩 처리

2. **app.json 설정**
   - 앱 이름: "Split TODO"
   - Bundle Identifier 설정
   - 아이콘 및 스플래시

## App.tsx 구조

```typescript
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

type RootStackParamList = {
  TaskList: undefined;
  TaskDetail: { taskId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const { initialize, isLoading, error } = useTaskStore();

  useEffect(() => {
    initialize();
  }, []);

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen />;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="TaskList">
            {({ navigation }) => (
              <TaskListScreen onTaskPress={(id) => navigation.navigate('TaskDetail', { taskId: id })} />
            )}
          </Stack.Screen>
          <Stack.Screen name="TaskDetail">
            {({ navigation, route }) => (
              <TaskDetailScreen taskId={route.params.taskId} onBack={() => navigation.goBack()} />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
```

## app.json 설정

```json
{
  "expo": {
    "name": "Split TODO",
    "slug": "split-todo",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.splittodo"
    },
    "android": {
      "package": "com.yourcompany.splittodo",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    }
  }
}
```

## 작업 절차

1. **프로젝트 문서 읽기** (필수)
   - tasks.md 파일 읽기 (9단계 섹션 확인)
   - app-plan.md 파일 읽기 (네비게이션 구조 및 앱 설정 확인)
2. App.tsx 파일 생성/수정
3. SafeAreaProvider 설정
4. NavigationContainer 구성
5. Stack Navigator 정의
6. 초기화 로직 추가
7. 로딩/에러 상태 처리
8. app.json 설정

## 로딩 및 에러 처리

### LoadingScreen
- ActivityIndicator (size="large", color="#3b82f6")
- "Split TODO" 텍스트

### ErrorScreen
- 에러 메시지 표시
- 재시도 버튼 (optional)

## 성공 기준

- ✅ App.tsx 완성
- ✅ Navigation 정상 동작
- ✅ 초기화 로직 실행
- ✅ 로딩/에러 상태 처리
- ✅ app.json 설정 완료
- ✅ iOS/Android 실행 가능

## 보고 형식

- 네비게이션 구조
- 초기화 프로세스
- 테스트 결과 (iOS/Android)
