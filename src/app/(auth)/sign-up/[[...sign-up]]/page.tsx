import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-tight text-white">CRES Solutions OS</p>
          <p className="mt-1 text-xs text-white/50">Create your account</p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-none',
            },
          }}
        />
      </div>
    </div>
  )
}
