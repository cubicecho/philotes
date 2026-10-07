import type { ContactValue } from '@/lib/primary-contact';

/** A label as the graph needs it: its name and hex colour. */
export type NetworkPersonLabel = {
  id: string;
  label: string;
  color: string;
};

/** A person as the graph draws them, with the relationships that start at them. */
export type NetworkPerson = {
  id: string;
  firstName: string;
  lastName: string;
  /** The person's email addresses; the main one is shown when they are pointed at. */
  contactInfos?: ContactValue[];
  /** The person's labels; the first one's colour fills their node. */
  labels: NetworkPersonLabel[];
  /** The relationships this person is the `from` side of; `type` is the name drawn on the edge. */
  relationshipsFrom: Array<{ id: string; toPersonId: string; type: string }>;
};

export interface NetworkGraphProps {
  /** Everyone to draw. A relationship to a person missing from this list is not drawn. */
  persons: NetworkPerson[];
  /** Called with a person's id when their node is clicked. */
  onOpenPerson: (id: string) => void;
}
