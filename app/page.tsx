import { createClient } from '@/utils/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  // This is an optional connection example; PointPlus tables are not created here.
  const { data: todos, error } = await supabase
    .from('todos')
    .select('id, name')
    .limit(20)

  return (
    <main style={{ maxWidth: 720, margin: '4rem auto', padding: '0 1.5rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>PointPlus</h1>
      <p>Next.js App Router + Supabase SSR starter.</p>
      <h2>Supabase connection example</h2>
      {error ? (
        <p>The optional <code>todos</code> table is not available yet. Create it and configure RLS policies to enable this example.</p>
      ) : todos && todos.length > 0 ? (
        <ul>
          {todos.map((todo) => (
            <li key={todo.id}>{todo.name}</li>
          ))}
        </ul>
      ) : (
        <p>No todos found.</p>
      )}
    </main>
  )
}
