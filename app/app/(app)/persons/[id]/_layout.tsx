import { Slot } from 'expo-router';

/** Passes each route under one person straight through, with no chrome of its own. */
export default function PersonLayout() {
  return <Slot />;
}
