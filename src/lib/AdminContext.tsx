import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface AdminContextType {
    isAdmin: boolean;
    setIsAdmin: (value: boolean) => void;
    checkAuth: () => boolean;
    logout: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        // Check localStorage on mount
        const auth = localStorage.getItem('admin_auth');
        if (auth === 'true') {
            setIsAdmin(true);
        }
    }, []);

    const checkAuth = (): boolean => {
        const auth = localStorage.getItem('admin_auth');
        return auth === 'true';
    };

    const logout = () => {
        localStorage.removeItem('admin_auth');
        setIsAdmin(false);
    };

    return (
        <AdminContext.Provider value={{ isAdmin, setIsAdmin, checkAuth, logout }}>
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
