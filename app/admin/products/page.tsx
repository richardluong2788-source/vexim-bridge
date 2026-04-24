import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProductSearchWidget } from '@/components/admin/product-search-widget';
import { isAdminShellRole, normaliseRole } from '@/lib/auth/permissions';

export const metadata = {
  title: 'Product Discovery | Admin',
  description: 'Search and discover products across all clients',
};

export default async function AdminProductsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = normaliseRole(profile?.role);

  if (!isAdminShellRole(role)) {
    redirect('/');
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <ProductSearchWidget />
      </div>
    </main>
  );
}
