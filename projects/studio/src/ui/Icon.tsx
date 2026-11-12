import {
  BellRing, BookOpen, Calendar, CalendarCheck, ChefHat, ClipboardList, Database, FileText, Globe, Megaphone,
  MessageCircle, Package, ScanText, Smile, Star, Users, UtensilsCrossed, Wrench, type LucideIcon,
} from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  'bell-ring': BellRing, 'book-open': BookOpen, calendar: Calendar, 'calendar-check': CalendarCheck, 'chef-hat': ChefHat,
  clipboard: ClipboardList, database: Database, 'file-text': FileText, globe: Globe, megaphone: Megaphone,
  'message-circle': MessageCircle, package: Package, 'scan-text': ScanText, smile: Smile, star: Star, users: Users,
  utensils: UtensilsCrossed, wrench: Wrench,
};

export function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const I = icons[name] ?? Package;
  return <I size={size} strokeWidth={1.75} className={className} />;
}
