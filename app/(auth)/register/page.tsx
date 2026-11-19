import type { Metadata } from 'next'
import { AuthForm } from '@/features/auth/auth-form'
export const metadata: Metadata = { title: 'สมัครสมาชิก' }
export default function RegisterPage() { return <AuthForm mode="register" /> }
