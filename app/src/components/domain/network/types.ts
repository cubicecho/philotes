export type NetworkPersonLabel = {
  id: string;
  label: string;
  color: string;
};

export type NetworkPerson = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  labels: NetworkPersonLabel[];
  relationshipsFrom: Array<{ id: string; toPersonId: string; type: string }>;
};

export interface NetworkGraphProps {
  persons: NetworkPerson[];
  onOpenPerson: (id: string) => void;
}
