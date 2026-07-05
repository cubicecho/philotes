import { Redirect, Slot } from 'expo-router';
import { isAuthenticated } from '@/lib/auth';
import { Header } from '@/components/layouts/header';

export default function AppLayout() {
  if (!isAuthenticated()) {
    return <Redirect href="/login" />;
  }
  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <main className="container mx-auto px-4 flex-1 overflow-hidden">
        <Slot />
      </main>
    </div>
  );
}
