import type { ElementType } from 'react';
import {
  Calculator, Percent, Coins, TrendingDown, Users, Scale, ShieldAlert, Landmark,
  BookOpen, CreditCard, FileText, Send, Building2, CalendarCheck, Contact,
  CheckSquare, Pin, CalendarClock,
} from 'lucide-react';

/**
 * 퀵독 도구 아이콘 (단일 출처)
 * - 이전에는 LegalQuickDock·FloatingToolWindow·ToolCustomizerModal이 같은 맵을 각각 들고 있어
 *   도구를 추가할 때 한 곳만 고치면 아이콘이 Calculator로 대체되는 문제가 있었다.
 */
export const TOOL_ICON_MAP: Record<string, ElementType> = {
  Calculator,
  Percent,
  Coins,
  TrendingDown,
  Users,
  Scale,
  ShieldAlert,
  Landmark,
  BookOpen,
  CreditCard,
  FileText,
  Send,
  Building2,
  CalendarCheck,
  Contact,
  CheckSquare,
  Pin,
  CalendarClock,
};

export function getToolIcon(iconName: string): ElementType {
  return TOOL_ICON_MAP[iconName] || Calculator;
}
