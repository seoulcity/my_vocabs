/// <reference types="@sveltejs/kit" />

declare global {
    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        // interface Platform {}
    }

    interface ImportMetaEnv {
        VITE_SUPABASE_URL: string;
        VITE_SUPABASE_ANON_KEY: string;
        VITE_OPENAI_API_KEY: string;
    }

    interface ImportMeta {
        readonly env: ImportMetaEnv;
    }
} 