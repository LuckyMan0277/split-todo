/**
 * Example data for demonstrating the Split TODO app
 *
 * Provides sample tasks that users can load to see how the app works
 * without having to create their own data first.
 */

import { Task } from '../types';
import { generateId } from '../utils/uuid';

/**
 * Example tasks demonstrating various use cases
 *
 * These tasks show:
 * - Different completion states (0%, partial, 100%)
 * - Various checklist lengths (short, medium, long)
 * - Different task types (work, personal, travel)
 */
export const EXAMPLE_TASKS: Task[] = [
  {
    id: generateId(),
    title: '웹사이트 리뉴얼 프로젝트',
    items: [
      {
        id: generateId(),
        title: '요구사항 분석 문서 작성',
        done: true,
      },
      {
        id: generateId(),
        title: '와이어프레임 디자인',
        done: true,
      },
      {
        id: generateId(),
        title: 'UI/UX 프로토타입 제작',
        done: true,
      },
      {
        id: generateId(),
        title: '프론트엔드 개발',
        done: false,
      },
      {
        id: generateId(),
        title: '백엔드 API 연동',
        done: false,
      },
      {
        id: generateId(),
        title: '반응형 디자인 적용',
        done: false,
      },
      {
        id: generateId(),
        title: 'QA 테스트',
        done: false,
      },
      {
        id: generateId(),
        title: '배포 및 오픈',
        done: false,
      },
    ],
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  },
  {
    id: generateId(),
    title: '제주도 여행 준비',
    items: [
      {
        id: generateId(),
        title: '항공권 예약',
        done: true,
      },
      {
        id: generateId(),
        title: '숙소 예약',
        done: true,
      },
      {
        id: generateId(),
        title: '렌터카 예약',
        done: true,
      },
      {
        id: generateId(),
        title: '여행 일정표 작성',
        done: false,
      },
      {
        id: generateId(),
        title: '맛집 리스트 정리',
        done: false,
      },
      {
        id: generateId(),
        title: '짐 싸기',
        done: false,
      },
    ],
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  },
  {
    id: generateId(),
    title: '새해 목표 달성하기',
    items: [
      {
        id: generateId(),
        title: '매일 30분 운동하기',
        done: false,
      },
      {
        id: generateId(),
        title: '한 달에 책 2권 읽기',
        done: false,
      },
      {
        id: generateId(),
        title: '새로운 기술 스택 공부하기',
        done: false,
      },
      {
        id: generateId(),
        title: '사이드 프로젝트 완성하기',
        done: false,
      },
    ],
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
  },
];
