import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInAnonymously, 
    signInWithCustomToken,
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    GoogleAuthProvider, 
    FacebookAuthProvider, 
    GithubAuthProvider, 
    OAuthProvider, 
    signInWithPopup 
} from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, onSnapshot, query, serverTimestamp } from 'firebase/firestore';

// --- SVG Icons ---
const PlusIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>);
const CreditCardIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>);
const PencilIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>);
const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);
const UndoIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>);
const XCircleIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>);
const GoogleIcon = () => (<svg className="w-5 h-5 mr-3" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 36.49 44 30.634 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>);
const FacebookIcon = () => (<svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor" color="#1877F2"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"></path></svg>);
const GithubIcon = () => (<svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.168 6.839 9.492.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.031-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.03 1.595 1.03 2.688 0 3.848-2.338 4.695-4.566 4.942.359.308.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.001 10.001 0 0022 12c0-5.523-4.477-10-10-10z" clipRule="evenodd"></path></svg>);
const MicrosoftIcon = () => (<svg className="w-5 h-5 mr-3" viewBox="0 0 24 24"><path fill="#F25022" d="M11.5 11.5H1V1h10.5v10.5z"></path><path fill="#7FBA00" d="M23.5 11.5H13V1h10.5v10.5z"></path><path fill="#00A4EF" d="M11.5 23.5H1V13h10.5V23.5z"></path><path fill="#FFB900" d="M23.5 23.5H13V13h10.5V23.5z"></path></svg>);

// --- Helper Functions & Constants ---
const CARD_1_NAME = 'ICICI Amazon Pay';
const CARD_2_NAME = 'ICICI Coral RuPay';

// --- Main App Component ---
const App = () => {
    // --- State Management ---
    const [expenses, setExpenses] = useState([]);
    const [recycleBin, setRecycleBin] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [currentView, setCurrentView] = useState('expenses');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState(null);
    const [authError, setAuthError] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoginView, setIsLoginView] = useState(true);

    // Firebase state
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [user, setUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // --- Firebase Initialization and Auth ---
    useEffect(() => {
        try {
            // PASTE YOUR FIREBASE CONFIG OBJECT HERE
            const firebaseConfig = {
              apiKey: "AIzaSyDiT3rCcLnrKy7R2-S61xv7eF4Q3JFUCv4",
              authDomain: "expense-tracker-by-rk.firebaseapp.com",
              projectId: "expense-tracker-by-rk",
              storageBucket: "expense-tracker-by-rk.firebasestorage.app",
              messagingSenderId: "208150166956",
              appId: "1:208150166956:web:fee677079d5feb2148ce09",
              measurementId: "G-57LLVKQZEH"
            };

            const app = initializeApp(firebaseConfig);
            const authInstance = getAuth(app);
            const dbInstance = getFirestore(app);

            setDb(dbInstance);
            setAuth(authInstance);

            const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    try {
                        // We sign in anonymously since we're on a public site
                        await signInAnonymously(authInstance);
                    } catch (authError) {
                        console.error("Firebase sign-in error:", authError);
                        setError("Could not connect to the service.");
                    }
                }
                setIsAuthReady(true);
            });
            return () => unsubscribe();
        } catch (e) {
            console.error("Error initializing Firebase:", e);
            setError("Application could not be initialized.");
            setIsLoading(false);
        }
    }, []);

    // --- Firestore Data Fetching ---
    useEffect(() => {
        if (!isAuthReady || !db || !user) {
            setExpenses([]);
            setRecycleBin([]);
            return;
        };

        const userId = user.uid;

        const expensesPath = `users/${userId}/expenses`;
        const qExpenses = query(collection(db, expensesPath));
        const unsubscribeExpenses = onSnapshot(qExpenses, (querySnapshot) => {
            const expensesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            expensesData.sort((a, b) => new Date(b.date) - new Date(a.date));
            setExpenses(expensesData);
        }, (err) => {
            console.error("Error fetching expenses:", err);
            setError("Could not fetch expenses.");
        });

        const recycleBinPath = `users/${userId}/recycleBin`;
        const qRecycleBin = query(collection(db, recycleBinPath));
        const unsubscribeRecycleBin = onSnapshot(qRecycleBin, (querySnapshot) => {
            const binData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            binData.sort((a, b) => new Date(b.date) - new Date(a.date));
            setRecycleBin(binData);
        }, (err) => {
            console.error("Error fetching recycle bin:", err);
            setError("Could not fetch recycle bin data.");
        });

        return () => {
            unsubscribeExpenses();
            unsubscribeRecycleBin();
        };
    }, [isAuthReady, db, user]);
    
    // --- Auth Handlers ---
    const handleAuthAction = async (e) => {
        e.preventDefault();
        setAuthError('');
        if (!email || !password) {
            setAuthError("Please enter both email and password.");
            return;
        }
        try {
            if (isLoginView) await signInWithEmailAndPassword(auth, email, password);
            else await createUserWithEmailAndPassword(auth, email, password);
        } catch (error) {
            setAuthError(error.message);
        }
    };
    
    const handleAnonymousLogin = async () => {
        setAuthError('');
        try {
            await signInAnonymously(auth);
        } catch (error) {
            setAuthError(error.message);
        }
    };
    
    const handleOAuthLogin = async (provider) => {
        setAuthError('');
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            setAuthError(error.message);
            console.error("OAuth Error:", error.code, error.message);
        }
    };

    const handleLogout = async () => {
        if(auth) {
            await signOut(auth);
            setUser(null);
        }
    };

    // --- CRUD Handlers ---
    const getCollectionPath = (colName) => {
        if (!db || !user) return null;
        return `users/${user.uid}/${colName}`;
    };

    const handleSaveExpense = async (expense) => {
        const path = getCollectionPath('expenses');
        if (!path) return;
        try {
            if (editingExpense) {
                const docRef = doc(db, path, expense.id);
                await setDoc(docRef, expense, { merge: true });
            } else {
                await addDoc(collection(db, path), { ...expense, createdAt: serverTimestamp() });
            }
            closeModal();
        } catch (e) {
            console.error("Error saving document: ", e);
            setError("Failed to save expense.");
        }
    };

    const handleDeleteExpense = async (expense) => {
        const expensesPath = getCollectionPath('expenses');
        const binPath = getCollectionPath('recycleBin');
        if (!expensesPath || !binPath) return;
        const expenseRef = doc(db, expensesPath, expense.id);
        const binRef = doc(db, binPath, expense.id);
        try {
            await setDoc(binRef, expense);
            await deleteDoc(expenseRef);
        } catch (e) {
            console.error("Error moving to recycle bin: ", e);
            setError("Failed to delete expense.");
        }
    };

    const handleRestoreExpense = async (expense) => {
        const expensesPath = getCollectionPath('expenses');
        const binPath = getCollectionPath('recycleBin');
        if (!expensesPath || !binPath) return;
        const expenseRef = doc(db, expensesPath, expense.id);
        const binRef = doc(db, binPath, expense.id);
        try {
            await setDoc(expenseRef, expense);
            await deleteDoc(binRef);
        } catch (e) {
            console.error("Error restoring expense: ", e);
            setError("Failed to restore expense.");
        }
    };
    
    const handlePermanentDelete = (id) => setDeletingId(id);
    
    const confirmPermanentDelete = async () => {
        if (!deletingId) return;
        const binPath = getCollectionPath('recycleBin');
        if (!binPath) return;
        const binRef = doc(db, binPath, deletingId);
        try {
            await deleteDoc(binRef);
        } catch (e) {
            console.error("Error permanently deleting: ", e);
            setError("Failed to permanently delete expense.");
        } finally {
            setDeletingId(null);
        }
    };

    // --- Modal Control ---
    const openModal = (expense = null) => {
        setEditingExpense(expense);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingExpense(null);
    };

    // --- Calculated Totals ---
    const totals = useMemo(() => {
        const card1Total = expenses.filter(e => e.card === CARD_1_NAME).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
        const card2Total = expenses.filter(e => e.card === CARD_2_NAME).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
        return { [CARD_1_NAME]: card1Total, [CARD_2_NAME]: card2Total, total: card1Total + card2Total };
    }, [expenses]);
    
    // --- Main App UI ---
    const MainApp = () => (
        <>
            <Header />
            <main>
                <SummaryCards />
                <NavBar />
                {error && <p className="text-red-500 bg-red-100 p-3 rounded-lg my-4 text-center">{error}</p>}
                <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mt-4">
                    {currentView === 'expenses' ? <ExpenseList /> : <RecycleBin />}
                </div>
            </main>
            <ExpenseModal />
            <ConfirmationModal />
        </>
    );

    // --- Sub-components ---
    const AuthScreen = () => {
        const googleProvider = new GoogleAuthProvider();
        const facebookProvider = new FacebookAuthProvider();
        const githubProvider = new GithubAuthProvider();
        const microsoftProvider = new OAuthProvider('microsoft.com');

        return (
            <div className="max-w-md mx-auto mt-10 p-8 border border-gray-200 rounded-2xl shadow-xl bg-white">
                <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-indigo-600">Expense Tracker</h1>
                    <p className="text-gray-500 mt-1">{isLoginView ? 'Sign in to continue' : 'Create an account to get started'}</p>
                </header>
                <form onSubmit={handleAuthAction}>
                    <div className="mb-4"><label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">Email Address</label><input className="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500" id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                    <div className="mb-6"><label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">Password</label><input className="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500" id="password" type="password" placeholder="******************" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                    {authError && <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">{authError}</p>}
                    <div className="flex flex-col items-center justify-between">
                        <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-150" type="submit">{isLoginView ? 'Sign In' : 'Sign Up'}</button>
                        <button type="button" onClick={() => setIsLoginView(!isLoginView)} className="inline-block align-baseline font-bold text-sm text-indigo-600 hover:text-indigo-800 mt-4">{isLoginView ? 'Need an account? Sign Up' : 'Already have an account? Sign In'}</button>
                    </div>
                </form>
                <div className="relative my-6 w-full"><div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-gray-300" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or continue with</span></div></div>
                <div className="space-y-3">
                    <button onClick={() => handleOAuthLogin(googleProvider)} className="w-full inline-flex items-center justify-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"><GoogleIcon />Sign in with Google</button>
                    <button onClick={() => handleOAuthLogin(facebookProvider)} className="w-full inline-flex items-center justify-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"><FacebookIcon />Sign in with Facebook</button>
                    <button onClick={() => handleOAuthLogin(githubProvider)} className="w-full inline-flex items-center justify-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"><GithubIcon />Sign in with GitHub</button>
                    <button onClick={() => handleOAuthLogin(microsoftProvider)} className="w-full inline-flex items-center justify-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"><MicrosoftIcon />Sign in with Microsoft</button>
                </div>
                 <div className="relative my-6 w-full"><div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-gray-300" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or</span></div></div>
                 <button type="button" onClick={handleAnonymousLogin} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-150">Continue as Guest</button>
            </div>
        );
    };

    const Header = () => (
        <header className="mb-6 flex justify-between items-center">
            <div>
                <h1 className="text-4xl font-bold text-indigo-600">Expense Tracker</h1>
                <p className="text-gray-500 mt-1">Welcome, {user.isAnonymous ? 'Guest' : (user.displayName || user.email)}</p>
            </div>
            <button onClick={handleLogout} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Logout</button>
        </header>
    );

    const SummaryCards = () => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200"><h3 className="text-sm font-semibold text-gray-500">{CARD_1_NAME}</h3><p className="text-2xl font-bold text-blue-600">₹{totals[CARD_1_NAME].toFixed(2)}</p></div>
            <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200"><h3 className="text-sm font-semibold text-gray-500">{CARD_2_NAME}</h3><p className="text-2xl font-bold text-green-600">₹{totals[CARD_2_NAME].toFixed(2)}</p></div>
            <div className="bg-indigo-600 text-white p-4 rounded-xl shadow-md"><h3 className="text-sm font-semibold text-indigo-200">Total Expenses</h3><p className="text-2xl font-bold">₹{totals.total.toFixed(2)}</p></div>
        </div>
    );

    const NavBar = () => (
        <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-2 rounded-xl shadow-md mb-4 gap-2">
            <div className="flex bg-gray-200 p-1 rounded-lg">
                <button onClick={() => setCurrentView('expenses')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${currentView === 'expenses' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600'}`}>Active Expenses</button>
                <button onClick={() => setCurrentView('bin')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${currentView === 'bin' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600'}`}>Recycle Bin</button>
            </div>
            <button onClick={() => openModal()} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-transform transform hover:scale-105"><PlusIcon /> Add New Expense</button>
        </div>
    );

    const ExpenseList = () => {
        if (expenses.length === 0) return <p className="text-center text-gray-500 py-8">No expenses yet. Add one to get started!</p>;
        return (
            <div className="space-y-3">{expenses.map(expense => (
                <div key={expense.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-4"><div className={`w-12 h-12 rounded-lg flex items-center justify-center ${expense.card === CARD_1_NAME ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}><CreditCardIcon /></div><div><p className="font-bold text-lg">₹{parseFloat(expense.amount).toFixed(2)}</p><p className="text-sm text-gray-600">{expense.description || 'No description'}</p><p className="text-xs text-gray-400">{new Date(expense.date).toLocaleDateString()} &bull; {expense.card}</p></div></div>
                    <div className="flex items-center gap-2"><button onClick={() => openModal(expense)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-200 rounded-full transition-colors"><PencilIcon /></button><button onClick={() => handleDeleteExpense(expense)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-200 rounded-full transition-colors"><TrashIcon /></button></div>
                </div>))}
            </div>
        );
    };

    const RecycleBin = () => {
        if (recycleBin.length === 0) return <p className="text-center text-gray-500 py-8">Recycle bin is empty.</p>;
        return (
            <div className="space-y-3">{recycleBin.map(expense => (
                <div key={expense.id} className="flex items-center justify-between bg-red-50 p-3 rounded-lg">
                    <div className="flex-1"><p className="font-bold">₹{parseFloat(expense.amount).toFixed(2)}</p><p className="text-sm text-gray-600">{expense.description || 'No description'}</p><p className="text-xs text-gray-400">{new Date(expense.date).toLocaleDateString()} &bull; {expense.card}</p></div>
                    <div className="flex items-center gap-2"><button onClick={() => handleRestoreExpense(expense)} className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-100 rounded-full transition-colors"><UndoIcon /></button><button onClick={() => handlePermanentDelete(expense.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"><XCircleIcon /></button></div>
                </div>))}
            </div>
        );
    };

    const ExpenseModal = () => {
        const [formData, setFormData] = useState({});
        useEffect(() => { setFormData(editingExpense ? { ...editingExpense } : { amount: '', date: new Date().toISOString().split('T')[0], description: '', card: CARD_1_NAME }); }, [editingExpense]);
        const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
        const handleSubmit = (e) => { e.preventDefault(); if (!formData.amount || parseFloat(formData.amount) <= 0) { alert("Please enter a valid amount."); return; } handleSaveExpense(formData); };
        if (!isModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md"><form onSubmit={handleSubmit}><div className="p-6"><h2 className="text-2xl font-bold mb-4">{editingExpense ? 'Edit Expense' : 'Add New Expense'}</h2><div className="mb-4"><label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label><input type="number" name="amount" id="amount" value={formData.amount} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" placeholder="0.00" step="0.01" required /></div><div className="mb-4"><label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">Date</label><input type="date" name="date" id="date" value={formData.date} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" required /></div><div className="mb-4"><label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label><input type="text" name="description" id="description" value={formData.description} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g., Coffee, Groceries" /></div><div><label className="block text-sm font-medium text-gray-700 mb-2">Card</label><div className="flex gap-4"><label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center ${formData.card === CARD_1_NAME ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}><input type="radio" name="card" value={CARD_1_NAME} checked={formData.card === CARD_1_NAME} onChange={handleChange} className="sr-only" /><span className="font-semibold text-sm">{CARD_1_NAME}</span></label><label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center ${formData.card === CARD_2_NAME ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}><input type="radio" name="card" value={CARD_2_NAME} checked={formData.card === CARD_2_NAME} onChange={handleChange} className="sr-only" /><span className="font-semibold text-sm">{CARD_2_NAME}</span></label></div></div></div><div className="bg-gray-50 px-6 py-3 flex justify-end gap-3 rounded-b-xl"><button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">{editingExpense ? 'Save Changes' : 'Add Expense'}</button></div></form></div></div>
        );
    };
    
    const ConfirmationModal = () => {
        if (!deletingId) return null;
        return (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-sm text-center p-6"><h3 className="text-lg font-bold text-gray-900">Are you sure?</h3><p className="text-sm text-gray-600 mt-2 mb-6">This action cannot be undone. The expense will be permanently deleted.</p><div className="flex justify-center gap-4"><button onClick={() => setDeletingId(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 w-full">Cancel</button><button onClick={confirmPermanentDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 w-full">Delete</button></div></div></div>
        );
    };

    // --- Render Logic ---
    if (!isAuthReady) {
        return <div className="text-center p-10">Loading application...</div>;
    }

    return (
        <div className="bg-gray-100 min-h-screen font-sans text-gray-800 p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
                {user ? <MainApp /> : <AuthScreen />}
            </div>
        </div>
    );
};

export default App;

