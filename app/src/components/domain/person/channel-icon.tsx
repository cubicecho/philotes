import { Mail, MessageSquare, Phone, Users, Video } from '@/components/app-icons';
import { Ellipsis } from '@/components/ui/icons';
import { InteractionChannel } from '@/lib/vocabulary';

/** The glyph for each channel. `video` is no longer offered, but older interactions may hold it. */
const CHANNEL_ICONS: Record<string, typeof Ellipsis> = {
  [InteractionChannel.Call]: Phone,
  [InteractionChannel.Text]: MessageSquare,
  [InteractionChannel.Email]: Mail,
  [InteractionChannel.InPerson]: Users,
  video: Video,
};

/** The glyph for an interaction channel; anything unrecognised gets the ellipsis. */
export function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  const Icon = CHANNEL_ICONS[channel] ?? Ellipsis;
  return <Icon className={className} />;
}
