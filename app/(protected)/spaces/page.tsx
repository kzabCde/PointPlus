import { redirect } from 'next/navigation'
/** Backward-compatible link for the old Space launcher. */
export default function SpacesPage() { redirect('/rooms') }
