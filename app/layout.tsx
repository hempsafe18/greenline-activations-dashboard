import { ClerkProvider, SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: 0, backgroundColor: '#f9fafb' }}>
        <ClerkProvider>
          <header style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 2rem', backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: 'bold', fontSize: '1.25rem', color: '#10B981' }}>Greenline Activations</div>
            <div>
              <Show when="signed-out">
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <SignInButton mode="modal" />
                </div>
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </div>
          </header>
          <main>
            {children}
          </main>
        </ClerkProvider>
      </body>
    </html>
  );
}
