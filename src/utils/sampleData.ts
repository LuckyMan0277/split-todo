/**
 * Sample Data Generator
 *
 * Provides example tasks for demo and testing purposes.
 * Used for TestFlight preview and onboarding.
 */

import { Task } from '../types';
import { generateId } from './uuid';
import { getTodayKey } from '../services/dailyRecords';

/**
 * Generates sample tasks with various states to showcase app features
 *
 * Features demonstrated:
 * - Multiple checklist items (some completed, some pending)
 * - Tasks with different completion percentages
 * - Tasks scheduled for today
 * - Fully completed tasks
 * - Tasks with long titles and many items
 */
export function generateSampleTasks(): Task[] {
  const now = new Date().toISOString();
  const todayKey = getTodayKey();

  return [
    // Task 1: 운동 루틴 (50% complete, scheduled for today)
    {
      id: generateId(),
      title: '운동 루틴',
      items: [
        {
          id: generateId(),
          title: '스트레칭 10분',
          done: true,
          createdAt: now,
          scheduledDates: [todayKey],
        },
        {
          id: generateId(),
          title: '스쿼트 30회',
          done: true,
          createdAt: now,
          scheduledDates: [todayKey],
        },
        {
          id: generateId(),
          title: '플랭크 1분',
          done: false,
          createdAt: now,
          scheduledDates: [todayKey],
        },
        {
          id: generateId(),
          title: '런닝 20분',
          done: false,
          createdAt: now,
          scheduledDates: [todayKey],
        },
      ],
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },

    // Task 2: 장보기 (75% complete)
    {
      id: generateId(),
      title: '장보기',
      items: [
        {
          id: generateId(),
          title: '우유',
          done: true,
          createdAt: now,
          scheduledDates: [],
        },
        {
          id: generateId(),
          title: '달걀',
          done: true,
          createdAt: now,
          scheduledDates: [],
        },
        {
          id: generateId(),
          title: '빵',
          done: true,
          createdAt: now,
          scheduledDates: [],
        },
        {
          id: generateId(),
          title: '과일',
          done: false,
          createdAt: now,
          scheduledDates: [],
        },
      ],
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },

    // Task 3: 프로젝트 준비 (33% complete, scheduled for today)
    {
      id: generateId(),
      title: '프로젝트 준비',
      items: [
        {
          id: generateId(),
          title: '자료 조사',
          done: true,
          createdAt: now,
          scheduledDates: [todayKey],
        },
        {
          id: generateId(),
          title: '기획서 작성',
          done: false,
          createdAt: now,
          scheduledDates: [todayKey],
        },
        {
          id: generateId(),
          title: '팀원들과 회의',
          done: false,
          createdAt: now,
          scheduledDates: [],
        },
      ],
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },

    // Task 4: 아침 루틴 (100% complete - will show celebration)
    {
      id: generateId(),
      title: '아침 루틴',
      items: [
        {
          id: generateId(),
          title: '물 한 잔 마시기',
          done: true,
          createdAt: now,
          scheduledDates: [],
        },
        {
          id: generateId(),
          title: '양치하기',
          done: true,
          createdAt: now,
          scheduledDates: [],
        },
        {
          id: generateId(),
          title: '아침 식사',
          done: true,
          createdAt: now,
          scheduledDates: [],
        },
      ],
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },

    // Task 5: 독서 목표 (20% complete)
    {
      id: generateId(),
      title: '이번 주 독서 목표',
      items: [
        {
          id: generateId(),
          title: '1장 읽기',
          done: true,
          createdAt: now,
          scheduledDates: [],
        },
        {
          id: generateId(),
          title: '2장 읽기',
          done: false,
          createdAt: now,
          scheduledDates: [],
        },
        {
          id: generateId(),
          title: '3장 읽기',
          done: false,
          createdAt: now,
          scheduledDates: [],
        },
        {
          id: generateId(),
          title: '4장 읽기',
          done: false,
          createdAt: now,
          scheduledDates: [],
        },
        {
          id: generateId(),
          title: '5장 읽기',
          done: false,
          createdAt: now,
          scheduledDates: [],
        },
      ],
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },

    // Task 6: 집안일 (0% complete - shows empty state)
    {
      id: generateId(),
      title: '주말 집안일',
      items: [
        {
          id: generateId(),
          title: '청소기 돌리기',
          done: false,
          createdAt: now,
          scheduledDates: [],
        },
        {
          id: generateId(),
          title: '빨래하기',
          done: false,
          createdAt: now,
          scheduledDates: [],
        },
        {
          id: generateId(),
          title: '설거지',
          done: false,
          createdAt: now,
          scheduledDates: [],
        },
      ],
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },

    // Task 7: 학습 계획 (60% complete)
    {
      id: generateId(),
      title: 'React Native 학습',
      items: [
        {
          id: generateId(),
          title: '공식 문서 읽기',
          done: true,
          createdAt: now,
          scheduledDates: [],
        },
        {
          id: generateId(),
          title: '튜토리얼 따라하기',
          done: true,
          createdAt: now,
          scheduledDates: [],
        },
        {
          id: generateId(),
          title: '샘플 앱 만들기',
          done: true,
          createdAt: now,
          scheduledDates: [],
        },
        {
          id: generateId(),
          title: '블로그 포스팅',
          done: false,
          createdAt: now,
          scheduledDates: [],
        },
        {
          id: generateId(),
          title: '프로젝트 적용',
          done: false,
          createdAt: now,
          scheduledDates: [],
        },
      ],
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
  ];
}

/**
 * Generates minimal sample data (fewer tasks for quick testing)
 */
export function generateMinimalSampleTasks(): Task[] {
  const now = new Date().toISOString();
  const todayKey = getTodayKey();

  return [
    {
      id: generateId(),
      title: '오늘 할 일',
      items: [
        {
          id: generateId(),
          title: '이메일 확인',
          done: true,
          createdAt: now,
          scheduledDates: [todayKey],
        },
        {
          id: generateId(),
          title: '회의 준비',
          done: false,
          createdAt: now,
          scheduledDates: [todayKey],
        },
        {
          id: generateId(),
          title: '보고서 작성',
          done: false,
          createdAt: now,
          scheduledDates: [todayKey],
        },
      ],
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      id: generateId(),
      title: '건강 관리',
      items: [
        {
          id: generateId(),
          title: '물 8잔 마시기',
          done: true,
          createdAt: now,
          scheduledDates: [],
        },
        {
          id: generateId(),
          title: '30분 걷기',
          done: false,
          createdAt: now,
          scheduledDates: [],
        },
      ],
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
  ];
}
