import type { LucideIcon, LucideProps } from 'lucide-react-native';
import ArrowDownWideNarrowSource from 'lucide-react-native/icons/arrow-down-wide-narrow';
import ArrowLeftSource from 'lucide-react-native/icons/arrow-left';
import ArrowRightSource from 'lucide-react-native/icons/arrow-right';
import CalendarSource from 'lucide-react-native/icons/calendar';
import CheckSource from 'lucide-react-native/icons/check';
import ChevronDownSource from 'lucide-react-native/icons/chevron-down';
import ChevronLeftSource from 'lucide-react-native/icons/chevron-left';
import ChevronRightSource from 'lucide-react-native/icons/chevron-right';
import ChevronUpSource from 'lucide-react-native/icons/chevron-up';
import ChevronsUpDownSource from 'lucide-react-native/icons/chevrons-up-down';
import CircleAlertSource from 'lucide-react-native/icons/circle-alert';
import CircleCheckSource from 'lucide-react-native/icons/circle-check';
import ClockSource from 'lucide-react-native/icons/clock';
import CopySource from 'lucide-react-native/icons/copy';
import DownloadSource from 'lucide-react-native/icons/download';
import EllipsisSource from 'lucide-react-native/icons/ellipsis';
import EyeSource from 'lucide-react-native/icons/eye';
import EyeOffSource from 'lucide-react-native/icons/eye-off';
import FileSource from 'lucide-react-native/icons/file';
import FilePenSource from 'lucide-react-native/icons/file-pen';
import FileTextSource from 'lucide-react-native/icons/file-text';
import FolderSource from 'lucide-react-native/icons/folder';
import FolderPenSource from 'lucide-react-native/icons/folder-pen';
import InfoSource from 'lucide-react-native/icons/info';
import KeyRoundSource from 'lucide-react-native/icons/key-round';
import LibrarySource from 'lucide-react-native/icons/library';
import LoaderCircleSource from 'lucide-react-native/icons/loader-circle';
import LockSource from 'lucide-react-native/icons/lock';
import MonitorSource from 'lucide-react-native/icons/monitor';
import MoonSource from 'lucide-react-native/icons/moon';
import PauseSource from 'lucide-react-native/icons/pause';
import PencilSource from 'lucide-react-native/icons/pencil';
import PlaySource from 'lucide-react-native/icons/play';
import PlugSource from 'lucide-react-native/icons/plug';
import PlusSource from 'lucide-react-native/icons/plus';
import RefreshCwSource from 'lucide-react-native/icons/refresh-cw';
import SearchSource from 'lucide-react-native/icons/search';
import SettingsSource from 'lucide-react-native/icons/settings';
import SquareSource from 'lucide-react-native/icons/square';
import SunSource from 'lucide-react-native/icons/sun';
import TagSource from 'lucide-react-native/icons/tag';
import Trash2Source from 'lucide-react-native/icons/trash-2';
import TriangleAlertSource from 'lucide-react-native/icons/triangle-alert';
import Undo2Source from 'lucide-react-native/icons/undo-2';
import UploadSource from 'lucide-react-native/icons/upload';
import UserRoundSource from 'lucide-react-native/icons/user-round';
import XSource from 'lucide-react-native/icons/x';
import { styled } from 'nativewind';
import { useContext } from 'react';
import { IconClassContext } from '@/components/ui/icons-base';
import { cn } from '@/lib/utils';

/** What a wrapped icon takes: lucide's props, with `className` doing the styling. */
export type IconProps = Omit<LucideProps, 'className'> & {
  className?: string | undefined;
};

/**
 * Wraps one lucide glyph the way every icon in this file is wrapped. Exported
 * so an app's extra glyph is one line, not a copy of this function — a copy
 * that would miss the next change to how `IconClassContext` merges:
 *
 * ```tsx
 * // app-icons.tsx
 * import ArchiveSource from "lucide-react-native/icons/archive";
 * import { icon } from "@/components/ui/icons";
 *
 * export const Archive = icon(ArchiveSource);
 * ```
 *
 * `icons.web.tsx` exports an `icon` that hands its argument back, so the
 * `app-icons.web.tsx` beside that file is the same line with the source taken
 * from `lucide-react`.
 */
export function icon(Source: LucideIcon) {
  const Styled = styled(Source, {
    className: {
      target: 'style',
      nativeStyleMapping: { width: true, height: true, color: true },
    },
  });

  return function Icon({ className, ...props }: IconProps) {
    const inherited = useContext(IconClassContext);
    return <Styled className={cn('text-foreground', inherited, className)} {...props} />;
  };
}

export const ArrowDownWideNarrow = icon(ArrowDownWideNarrowSource);
export const ArrowLeft = icon(ArrowLeftSource);
export const ArrowRight = icon(ArrowRightSource);
export const Calendar = icon(CalendarSource);
export const Check = icon(CheckSource);
export const ChevronDown = icon(ChevronDownSource);
export const ChevronLeft = icon(ChevronLeftSource);
export const ChevronRight = icon(ChevronRightSource);
export const ChevronUp = icon(ChevronUpSource);
export const ChevronsUpDown = icon(ChevronsUpDownSource);
export const CircleAlert = icon(CircleAlertSource);
export const CircleCheck = icon(CircleCheckSource);
export const Clock = icon(ClockSource);
export const Copy = icon(CopySource);
export const Download = icon(DownloadSource);
export const Ellipsis = icon(EllipsisSource);
export const Eye = icon(EyeSource);
export const EyeOff = icon(EyeOffSource);
export const File = icon(FileSource);
export const FilePen = icon(FilePenSource);
export const FileText = icon(FileTextSource);
export const Folder = icon(FolderSource);
export const FolderPen = icon(FolderPenSource);
export const Info = icon(InfoSource);
export const KeyRound = icon(KeyRoundSource);
export const Library = icon(LibrarySource);
export const LoaderCircle = icon(LoaderCircleSource);
export const Lock = icon(LockSource);
export const Monitor = icon(MonitorSource);
export const Moon = icon(MoonSource);
export const Pause = icon(PauseSource);
export const Pencil = icon(PencilSource);
export const Play = icon(PlaySource);
export const Plug = icon(PlugSource);
export const Plus = icon(PlusSource);
export const RefreshCw = icon(RefreshCwSource);
export const Search = icon(SearchSource);
export const Settings = icon(SettingsSource);
export const Square = icon(SquareSource);
export const Sun = icon(SunSource);
export const Tag = icon(TagSource);
export const Trash2 = icon(Trash2Source);
export const TriangleAlert = icon(TriangleAlertSource);
export const Undo2 = icon(Undo2Source);
export const Upload = icon(UploadSource);
export const UserRound = icon(UserRoundSource);
export const X = icon(XSource);
