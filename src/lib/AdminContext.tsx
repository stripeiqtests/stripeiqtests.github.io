/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AdminContextType {
    isAdmin: boolean;
    authLoading: boolean;
    login: (email: string, password: string) => Promise<string | null>;
    logout: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

function sessionIsAdmin(session: Session | null) {
    const metadata = session?.user.app_metadata;
    return metadata?.role === 'admin' || metadata?.is_admin === true;
}

export function AdminProvider({ children }: { children: ReactNode }) {
    const [isAdmin, setIsAdmin] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        let active = true;

        supabase.auth.getSession().then(({ data }) => {
            if (!active) return;
            setIsAdmin(sessionIsAdmin(data.session));
            setAuthLoading(false);
        });

        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!active) return;
            setIsAdmin(sessionIsAdmin(session));
            setAuthLoading(false);
        });

        return () => {
            active = false;
            listener.subscription.unsubscribe();
        };
    }, []);

    const login = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return error.message;
        if (!sessionIsAdmin(data.session)) {
            await supabase.auth.signOut();
            return 'This account does not have the administrator role.';
        }
        setIsAdmin(true);
        return null;
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setIsAdmin(false);
    };

    return (
        <AdminContext.Provider value={{ isAdmin, authLoading, login, logout }}>
            {children}
        </AdminContext.Provider>
    );
}

export function useAdmin() {
    const context = useContext(AdminContext);
    if (context === undefined) {
        throw new Error('useAdmin must be used within an AdminProvider');
    }
    return context;
}
