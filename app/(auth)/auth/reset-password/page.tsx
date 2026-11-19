import type { Metadata } from 'next'
import { AuthForm } from '@/features/auth/auth-form'
export const metadata: Metadata = { title: 'ตั้งรหัสผ่านใหม่' }
export default function ResetPage() { return <AuthForm mode="reset" /> }
