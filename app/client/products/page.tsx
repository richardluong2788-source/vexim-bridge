import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ClientProductsList } from '@/components/client/client-products-list';

export const metadata = {
  title: 'My Products | ESH Client Portal',
  description: 'Manage your product catalog',
};

export default async function ClientProductsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get client profile to confirm they're a client
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, company_name')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'client') {
    redirect('/');
  }

  return (
    <main className="min-h-screen bg-background">
      <ClientProductsList clientId={user.id} />
    </main>
  );
}
