import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, EmailAuthProvider, reauthenticateWithCurrentUser, updateEmail } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, setDoc, getDoc, deleteDoc, onSnapshot, query, serverTimestamp, orderBy, writeBatch, where } from 'firebase/firestore';

// --- Main App Component ---
export default function App() {
    // --- State Management ---
    const [expenses, setExpenses] = useState([]);
    const [recycleBin, setRecycleBin] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [currentView, setCurrentView] = useState('expenses'); // 'expenses' or 'bin'
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [cardNames, setCardNames] = useState({ card1: 'Card 1', card2: 'Card 2' });
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    const [selectedExpenses, setSelectedExpenses] = useState([]);
    const [selectedBinItems, setSelectedBinItems] = useState([]);
    const [filterCard, setFilterCard] = useState('all'); // 'all', 'card1', or 'card2'
    const [customUserId, setCustomUserId] = useState('');


    // Firebase state
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    // --- Theme Management ---
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    };

    // --- Firebase Initialization and Auth ---
    useEffect(() => {
        try {
            const firebaseConfig = {
              apiKey: process.env.REACT_APP_API_KEY,
              authDomain: process.env.REACT_APP_AUTH_DOMAIN,
              projectId: process.env.REACT_APP_PROJECT_ID,
              storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
              messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
              appId: process.env.REACT_APP_APP_ID,
              measurementId: process.env.REACT_APP_MEASUREMENT_ID
            };


            const app = initializeApp(firebaseConfig);
            const authInstance = getAuth(app);
            const dbInstance = getFirestore(app);

            setDb(dbInstance);
            setAuth(authInstance);

            const unsubscribe = onAuthStateChanged(authInstance, (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    setUserId(null);
                    setExpenses([]);
                    setRecycleBin([]);
                    setCustomUserId('');
                }
                setIsAuthReady(true);
                setIsLoading(false);
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
        if (!isAuthReady || !db || !userId) {
            if (!userId) setIsLoading(false);
            return;
        }

        setIsLoading(true);

        // Fetch card names
        const settingsRef = doc(db, `users/${userId}/settings/cardConfig`);
        const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                setCardNames(docSnap.data());
            } else {
                const defaultNames = { card1: 'ICICI Amazon Pay', card2: 'ICICI Coral RuPay' };
                if (!auth.currentUser.isAnonymous) {
                  setDoc(settingsRef, defaultNames).catch(e => console.error("Could not create default card names", e));
                }
                setCardNames(defaultNames);
            }
        });

        // Fetch user profile (for customUserId)
        const profileRef = doc(db, `users/${userId}/settings/profile`);
        const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
            if (docSnap.exists()) {
                setCustomUserId(docSnap.data().customUserId);
            }
        });
        
        // Fetch all active expenses, sorted by date
        const expensesPath = `users/${userId}/expenses`;
        const qExpenses = query(collection(db, expensesPath), orderBy('date', 'desc'));
        const unsubscribeExpenses = onSnapshot(qExpenses, (querySnapshot) => {
            const expensesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setExpenses(expensesData);
            setIsLoading(false);
        });

        // Fetch all recycled expenses, sorted by date
        const recycleBinPath = `users/${userId}/recycleBin`;
        const qRecycleBin = query(collection(db, recycleBinPath), orderBy('date', 'desc'));
        const unsubscribeRecycleBin = onSnapshot(qRecycleBin, (querySnapshot) => {
            const binData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRecycleBin(binData);
        });

        return () => {
            unsubscribeExpenses();
            unsubscribeRecycleBin();
            unsubscribeSettings();
            unsubscribeProfile();
        };
    }, [isAuthReady, db, userId, auth]);

    // --- Client-side Filtering ---
    const filteredExpenses = useMemo(() => {
        if (filterCard === 'all') return expenses;
        return expenses.filter(expense => expense.card === filterCard);
    }, [expenses, filterCard]);

    const filteredRecycleBin = useMemo(() => {
        if (filterCard === 'all') return recycleBin;
        return recycleBin.filter(item => item.card === filterCard);
    }, [recycleBin, filterCard]);

    // --- Selection Handlers ---
    const handleToggleSelect = (expenseId, view) => {
        const setSelection = view === 'expenses' ? setSelectedExpenses : setSelectedBinItems;
        setSelection(prev => prev.includes(expenseId) ? prev.filter(id => id !== expenseId) : [...prev, expenseId]);
    };

    const handleToggleSelectAll = (view) => {
        const sourceList = view === 'expenses' ? filteredExpenses : filteredRecycleBin;
        const selectedList = view === 'expenses' ? selectedExpenses : selectedBinItems;
        const setSelection = view === 'expenses' ? setSelectedExpenses : setSelectedBinItems;

        if (selectedList.length === sourceList.length) {
            setSelection([]);
        } else {
            setSelection(sourceList.map(item => item.id));
        }
    };
    
    // --- Auth Handlers ---
    const handleSignUp = async (customId, password) => {
        setError('');
        if (!db || !auth) return;
        const lowerCaseId = customId.toLowerCase();
        
        const usernameDocRef = doc(db, 'usernames', lowerCaseId);
        const usernameDoc = await getDoc(usernameDocRef);
        
        if (usernameDoc.exists()) {
            setError('This User ID is already taken.');
            return;
        }

        const email = `${lowerCaseId}@expense-tracker.app`;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const batch = writeBatch(db);
            batch.set(usernameDocRef, { uid: user.uid, email: email });
            const profileDocRef = doc(db, `users/${user.uid}/settings/profile`);
            batch.set(profileDocRef, { customUserId: customId });
            await batch.commit();

        } catch (err) {
            setError(err.message);
            console.error("Sign up error:", err);
        }
    };

    const handleLogin = async (customId, password) => {
        setError('');
        if (!db || !auth) return;
        const lowerCaseId = customId.toLowerCase();

        const usernameDocRef = doc(db, 'usernames', lowerCaseId);
        try {
            const usernameDoc = await getDoc(usernameDocRef);
            if (!usernameDoc.exists()) {
                setError('User ID not found.');
                return;
            }
            const { email } = usernameDoc.data();
            
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError(err.message);
            console.error("Login error:", err);
        }
    };


    const handleAnonymousSignIn = async () => {
        setError('');
        try {
            await signInAnonymously(auth);
        } catch (err) {
            setError(err.message);
            console.error("Anonymous sign-in error:", err);
        }
    };

    const handleLogout = async () => {
        setError('');
        try {
            await signOut(auth);
        } catch (err) {
            setError("Failed to log out.");
            console.error("Logout error:", err);
        }
    };

    // --- CRUD Handlers ---
    const handleAddExpense = async (expense) => {
        if (!db || !userId) return;
        const expensesPath = `/users/${userId}/expenses`;
        try {
            await addDoc(collection(db, expensesPath), { ...expense, createdAt: serverTimestamp() });
            closeModal();
        } catch (e) {
            console.error("Error adding document: ", e);
            setError("Failed to add expense.");
        }
    };

    const handleUpdateExpense = async (expense) => {
        if (!db || !userId) return;
        const docRef = doc(db, `/users/${userId}/expenses`, expense.id);
        try {
            await setDoc(docRef, expense, { merge: true });
            closeModal();
        } catch (e) {
            console.error("Error updating document: ", e);
            setError("Failed to update expense.");
        }
    };
    
    const handleUpdateCardNames = async (newNames) => {
        if (!db || !userId) return;
        const settingsRef = doc(db, `users/${userId}/settings/cardConfig`);
        try {
            await setDoc(settingsRef, newNames, { merge: true });
            setIsSettingsModalOpen(false);
        } catch (e) {
            console.error("Error updating card names: ", e);
            setError("Failed to update card names.");
        }
    };
    
    const handleUpdateUserId = async (newCustomId, password) => {
        setError('');
        if (!db || !auth.currentUser || !customUserId) return;

        const lowerCaseNewId = newCustomId.toLowerCase();
        const currentUser = auth.currentUser;
        
        if (lowerCaseNewId === customUserId.toLowerCase()) {
            setError("This is already your User ID.");
            return;
        }

        const newUsernameDocRef = doc(db, 'usernames', lowerCaseNewId);
        const newUsernameDoc = await getDoc(newUsernameDocRef);
        if (newUsernameDoc.exists()) {
            setError('This User ID is already taken.');
            return;
        }

        try {
            const credential = EmailAuthProvider.credential(currentUser.email, password);
            await reauthenticateWithCurrentUser(currentUser, credential);
        } catch (err) {
            setError('Incorrect password. User ID not changed.');
            return;
        }
        
        const newEmail = `${lowerCaseNewId}@expense-tracker.app`;
        try {
            await updateEmail(currentUser, newEmail);
        } catch (err) {
            setError('Failed to update authentication details. Please try again.');
            return;
        }

        const oldUsernameDocRef = doc(db, 'usernames', customUserId.toLowerCase());
        const profileDocRef = doc(db, `users/${currentUser.uid}/settings/profile`);
        const batch = writeBatch(db);
        
        batch.set(newUsernameDocRef, { uid: currentUser.uid, email: newEmail });
        batch.update(profileDocRef, { customUserId: newCustomId });
        batch.delete(oldUsernameDocRef);

        try {
            await batch.commit();
            setIsSettingsModalOpen(false);
        } catch (err) {
            setError('Failed to update database. Please contact support.');
        }
    };


    const handleDeleteExpense = async (expense) => {
        if (!db || !userId) return;
        const expenseRef = doc(db, `/users/${userId}/expenses`, expense.id);
        const binRef = doc(db, `/users/${userId}/recycleBin`, expense.id);
        try {
            await setDoc(binRef, expense);
            await deleteDoc(expenseRef);
        } catch (e) {
            console.error("Error moving to recycle bin: ", e);
            setError("Failed to delete expense.");
        }
    };
    
    const handleDeleteSelected = async () => {
        if (!db || !userId || selectedExpenses.length === 0) return;
        const batch = writeBatch(db);
        const expensesToMove = expenses.filter(exp => selectedExpenses.includes(exp.id));
        expensesToMove.forEach(expense => {
            const expenseRef = doc(db, `users/${userId}/expenses`, expense.id);
            const binRef = doc(db, `users/${userId}/recycleBin`, expense.id);
            batch.set(binRef, expense);
            batch.delete(expenseRef);
        });
        try {
            await batch.commit();
            setSelectedExpenses([]);
        } catch (e) {
            setError("Failed to delete selected expenses.");
        }
    };

    const handleRestoreExpense = async (expense) => {
        if (!db || !userId) return;
        const expenseRef = doc(db, `/users/${userId}/expenses`, expense.id);
        const binRef = doc(db, `/users/${userId}/recycleBin`, expense.id);
        try {
            await setDoc(expenseRef, expense);
            await deleteDoc(binRef);
        } catch (e) {
            setError("Failed to restore expense.");
        }
    };

    const handleRestoreSelected = async () => {
        if (!db || !userId || selectedBinItems.length === 0) return;
        const batch = writeBatch(db);
        const itemsToRestore = recycleBin.filter(item => selectedBinItems.includes(item.id));
        itemsToRestore.forEach(item => {
            const expenseRef = doc(db, `users/${userId}/expenses`, item.id);
            const binRef = doc(db, `users/${userId}/recycleBin`, item.id);
            batch.set(expenseRef, item);
            batch.delete(binRef);
        });
        try {
            await batch.commit();
            setSelectedBinItems([]);
        } catch (e) {
            setError("Failed to restore selected items.");
        }
    };

    const handlePermanentDelete = async (id) => {
        if (!db || !userId) return;
        if (window.confirm("Are you sure? This cannot be undone.")) {
            const binRef = doc(db, `/users/${userId}/recycleBin`, id);
            try {
                await deleteDoc(binRef);
            } catch (e) {
                setError("Failed to permanently delete expense.");
            }
        }
    };

    const handlePermanentDeleteSelected = async () => {
        if (!db || !userId || selectedBinItems.length === 0) return;
        if (window.confirm(`Permanently delete ${selectedBinItems.length} items?`)) {
            const batch = writeBatch(db);
            selectedBinItems.forEach(id => {
                const binRef = doc(db, `users/${userId}/recycleBin`, id);
                batch.delete(binRef);
            });
            try {
                await batch.commit();
                setSelectedBinItems([]);
            } catch (e) {
                setError("Failed to permanently delete selected items.");
            }
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
        const card1Total = expenses.filter(e => e.card === 'card1').reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
        const card2Total = expenses.filter(e => e.card === 'card2').reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
        return { total: card1Total + card2Total, card1: card1Total, card2: card2Total };
    }, [expenses]);
    
    // --- Render Logic ---
    if (!isAuthReady) {
        return <div className="bg-gray-100 dark:bg-gray-900 min-h-screen flex items-center justify-center"><p className="dark:text-white">Loading application...</p></div>;
    }

    if (!userId) {
        return <LoginScreen onLogin={handleLogin} onSignUp={handleSignUp} onAnonymous={handleAnonymousSignIn} error={error} setError={setError} />;
    }

    return (
        <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 transition-colors duration-300">
            <div className="max-w-4xl mx-auto w-full flex flex-col p-4 sm:p-6 lg:p-8 min-h-0">
                <Header 
                    customUserId={customUserId} 
                    onLogout={handleLogout} 
                    onOpenSettings={() => setIsSettingsModalOpen(true)}
                    onToggleTheme={toggleTheme}
                    theme={theme}
                />
                <main className="flex flex-col flex-grow min-h-0">
                    <SummaryCards totals={totals} cardNames={cardNames} />
                    <NavBar currentView={currentView} setCurrentView={setCurrentView} onAddNew={() => openModal()} filterCard={filterCard} onFilterChange={setFilterCard} cardNames={cardNames} />
                    {error && <p className="text-red-500 bg-red-100 dark:bg-red-900/20 dark:text-red-400 p-3 rounded-lg my-4 text-center">{error}</p>}
                    <div className="flex-grow overflow-y-auto mt-4">
                        {isLoading ? <div className="text-center p-10"><p>Loading your expenses...</p></div> : 
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
                                {currentView === 'expenses' ? (
                                    <ExpenseList expenses={filteredExpenses} onEdit={openModal} onDelete={handleDeleteExpense} cardNames={cardNames} selectedExpenses={selectedExpenses} onToggleSelect={(id) => handleToggleSelect(id, 'expenses')} onToggleSelectAll={() => handleToggleSelectAll('expenses')} onDeleteSelected={handleDeleteSelected} />
                                ) : (
                                    <RecycleBin bin={filteredRecycleBin} onRestore={handleRestoreExpense} onDelete={handlePermanentDelete} cardNames={cardNames} selectedBinItems={selectedBinItems} onToggleSelect={(id) => handleToggleSelect(id, 'bin')} onToggleSelectAll={() => handleToggleSelectAll('bin')} onRestoreSelected={handleRestoreSelected} onDeleteSelected={handlePermanentDeleteSelected} />
                                )}
                            </div>
                        }
                    </div>
                </main>
            </div>
            {isModalOpen && <ExpenseModal isOpen={isModalOpen} onClose={closeModal} onSave={editingExpense ? handleUpdateExpense : handleAddExpense} expense={editingExpense} cardNames={cardNames} />}
            {isSettingsModalOpen && <SettingsModal isOpen={isSettingsModalOpen} onClose={() => { setIsSettingsModalOpen(false); setError(''); }} onSaveUserId={handleUpdateUserId} onSaveCardNames={handleUpdateCardNames} currentNames={cardNames} currentUserId={customUserId} error={error} />}
        </div>
    );
}

// --- Sub-components ---

const LoginScreen = ({ onLogin, onSignUp, onAnonymous, error, setError }) => {
    const [customUserId, setCustomUserId] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e, handler) => {
        e.preventDefault();
        setError('');
        if (!customUserId || !password) {
            setError("Please enter both User ID and password.");
            return;
        }
        handler(customUserId, password);
    };

    return (
        <div className="bg-gray-100 dark:bg-gray-900 min-h-screen flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <header className="mb-6 text-center">
                    <h1 className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">Expense Tracker</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Sign in to continue</p>
                </header>
                <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
                    <form>
                        <div className="mb-4">
                            <label htmlFor="customUserId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User ID</label>
                            <input type="text" id="customUserId" value={customUserId} onChange={(e) => setCustomUserId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white" placeholder="your-unique-id" required />
                        </div>
                        <div className="mb-6">
                            <label htmlFor="password"className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white" placeholder="••••••••" required />
                        </div>
                        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
                        <div className="flex flex-col gap-3">
                           <button type="button" onClick={(e) => handleSubmit(e, onLogin)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Login</button>
                           <button type="button" onClick={(e) => handleSubmit(e, onSignUp)} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Sign Up</button>
                        </div>
                    </form>
                    <div className="my-6 flex items-center">
                        <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                        <span className="mx-4 text-sm text-gray-500 dark:text-gray-400">OR</span>
                        <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                    </div>
                    <button onClick={onAnonymous} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 font-bold py-2 px-4 rounded-lg transition-colors">Continue Anonymously</button>
                </div>
            </div>
        </div>
    );
};

const Header = ({ customUserId, onLogout, onOpenSettings, onToggleTheme, theme }) => (
    <header className="mb-6">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                 <button onClick={onOpenSettings} className="bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 p-2 rounded-full transition-colors" title="Settings">
                    <UserIcon />
                </button>
                <button onClick={onToggleTheme} className="bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 p-2 rounded-full transition-colors" title="Toggle Theme">
                    {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                </button>
            </div>
            <div className="text-center">
                 <h1 className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">Expense Tracker</h1>
                 <p className="text-gray-500 dark:text-gray-400 mt-1">Welcome, <span className="font-semibold">{customUserId || 'Guest'}</span></p>
            </div>
            <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-3 rounded-lg text-sm transition-colors">
                Logout
            </button>
        </div>
    </header>
);

const SummaryCards = ({ totals, cardNames }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 truncate">{cardNames.card1}</h3>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">₹{totals.card1?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 truncate">{cardNames.card2}</h3>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">₹{totals.card2?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="bg-indigo-600 dark:bg-indigo-500 text-white p-4 rounded-xl shadow-md">
            <h3 className="text-sm font-semibold text-indigo-200 dark:text-indigo-200">Total Expenses</h3>
            <p className="text-2xl font-bold">₹{totals.total.toFixed(2)}</p>
        </div>
    </div>
);

const NavBar = ({ currentView, setCurrentView, onAddNew, filterCard, onFilterChange, cardNames }) => (
    <div className="flex flex-col sm:flex-row items-center justify-between bg-white dark:bg-gray-800 p-2 rounded-xl shadow-md gap-2">
        <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
            <button onClick={() => setCurrentView('expenses')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${currentView === 'expenses' ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>
                Active Expenses
            </button>
            <button onClick={() => setCurrentView('bin')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${currentView === 'bin' ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>
                Recycle Bin
            </button>
        </div>

        <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
            <button onClick={() => onFilterChange('all')} className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${filterCard === 'all' ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>
                All
            </button>
            <button onClick={() => onFilterChange('card1')} className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors truncate ${filterCard === 'card1' ? 'bg-blue-500 dark:bg-blue-600 text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>
                {cardNames.card1}
            </button>
            <button onClick={() => onFilterChange('card2')} className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors truncate ${filterCard === 'card2' ? 'bg-green-500 dark:bg-green-600 text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>
                {cardNames.card2}
            </button>
        </div>
        
        <button onClick={onAddNew} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-transform transform hover:scale-105">
            <PlusIcon /> Add New Expense
        </button>
    </div>
);

const ExpenseList = ({ expenses, onEdit, onDelete, cardNames, selectedExpenses, onToggleSelect, onToggleSelectAll, onDeleteSelected }) => {
    if (expenses.length === 0) {
        return <p className="text-center text-gray-500 dark:text-gray-400 py-8">No expenses yet. Add one to get started!</p>;
    }
    const getCardName = (cardId) => cardId === 'card1' ? cardNames.card1 : cardNames.card2;
    
    return (
        <div>
            {selectedExpenses.length > 0 && (
                <div className="flex items-center justify-between p-2 mb-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <span className="text-sm font-medium">{selectedExpenses.length} selected</span>
                    <button onClick={onDeleteSelected} className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-lg text-sm">Delete Selected</button>
                </div>
            )}
            <div className="space-y-3">
                <div className="flex items-center bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                    <input type="checkbox" className="form-checkbox h-5 w-5 text-indigo-600 bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-500 rounded focus:ring-indigo-500" onChange={onToggleSelectAll} checked={expenses.length > 0 && selectedExpenses.length === expenses.length} />
                    <span className="ml-4 text-sm font-medium text-gray-500 dark:text-gray-400">Select All</span>
                </div>

                {expenses.map(expense => (
                    <div key={expense.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                        <input type="checkbox" className="form-checkbox h-5 w-5 text-indigo-600 bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-500 rounded focus:ring-indigo-500" checked={selectedExpenses.includes(expense.id)} onChange={() => onToggleSelect(expense.id)} />
                        <div className="flex items-center gap-4 flex-grow ml-4">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${expense.card === 'card1' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400'}`}>
                                <CreditCardIcon />
                            </div>
                            <div>
                                <p className="font-bold text-lg">₹{parseFloat(expense.amount).toFixed(2)}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300">{expense.description || 'No description'}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(expense.date).toLocaleDateString()} &bull; {getCardName(expense.card)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => onEdit(expense)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600 rounded-full transition-colors"><PencilIcon /></button>
                            <button onClick={() => onDelete(expense)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600 rounded-full transition-colors"><TrashIcon /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const RecycleBin = ({ bin, onRestore, onDelete, cardNames, selectedBinItems, onToggleSelect, onToggleSelectAll, onRestoreSelected, onDeleteSelected }) => {
    if (bin.length === 0) {
        return <p className="text-center text-gray-500 dark:text-gray-400 py-8">Recycle bin is empty.</p>;
    }
    const getCardName = (cardId) => cardId === 'card1' ? cardNames.card1 : cardNames.card2;

    return (
        <div>
            {selectedBinItems.length > 0 && (
                 <div className="flex items-center justify-between p-2 mb-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <span className="text-sm font-medium">{selectedBinItems.length} selected</span>
                    <div className="flex gap-2">
                        <button onClick={onRestoreSelected} className="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded-lg text-sm">Restore</button>
                        <button onClick={onDeleteSelected} className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-lg text-sm">Delete Permanently</button>
                    </div>
                </div>
            )}
             <div className="space-y-3">
                 <div className="flex items-center bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                    <input type="checkbox" className="form-checkbox h-5 w-5 text-indigo-600 bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-500 rounded focus:ring-indigo-500" onChange={onToggleSelectAll} checked={bin.length > 0 && selectedBinItems.length === bin.length} />
                    <span className="ml-4 text-sm font-medium text-gray-500 dark:text-gray-400">Select All</span>
                </div>

                {bin.map(expense => (
                    <div key={expense.id} className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                        <input type="checkbox" className="form-checkbox h-5 w-5 text-indigo-600 bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-500 rounded focus:ring-indigo-500" checked={selectedBinItems.includes(expense.id)} onChange={() => onToggleSelect(expense.id)} />
                        <div className="flex-1 ml-4">
                            <p className="font-bold">₹{parseFloat(expense.amount).toFixed(2)}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{expense.description || 'No description'}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(expense.date).toLocaleDateString()} &bull; {getCardName(expense.card)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                             <button onClick={() => onRestore(expense)} className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-green-900/50 rounded-full transition-colors"><UndoIcon /></button>
                            <button onClick={() => onDelete(expense.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-red-900/50 rounded-full transition-colors"><XCircleIcon /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ExpenseModal = ({ isOpen, onClose, onSave, expense, cardNames }) => {
    const [formData, setFormData] = useState({ amount: '', date: new Date().toISOString().split('T')[0], description: '', card: 'card1' });

    useEffect(() => {
        if (expense) {
            setFormData({ id: expense.id, amount: expense.amount, date: expense.date, description: expense.description || '', card: expense.card });
        } else {
             setFormData({ amount: '', date: new Date().toISOString().split('T')[0], description: '', card: 'card1' });
        }
    }, [expense]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            alert("Please enter a valid amount.");
            return;
        }
        onSave(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <h2 className="text-2xl font-bold mb-4 dark:text-white">{expense ? 'Edit Expense' : 'Add New Expense'}</h2>
                        <div className="mb-4">
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (₹)</label>
                            <input type="number" name="amount" id="amount" value={formData.amount} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white" placeholder="0.00" step="0.01" required />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                            <input type="date" name="date" id="date" value={formData.date} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white" required />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Optional)</label>
                            <input type="text" name="description" id="description" value={formData.description} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white" placeholder="e.g., Coffee, Groceries" />
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Card</label>
                             <div className="flex gap-4">
                                 <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center ${formData.card === 'card1' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 dark:border-blue-400' : 'border-gray-300 dark:border-gray-600'}`}>
                                     <input type="radio" name="card" value="card1" checked={formData.card === 'card1'} onChange={handleChange} className="sr-only" />
                                     <span className="font-semibold text-sm">{cardNames.card1}</span>
                                 </label>
                                 <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center ${formData.card === 'card2' ? 'border-green-500 bg-green-50 dark:bg-green-900/50 dark:border-green-400' : 'border-gray-300 dark:border-gray-600'}`}>
                                     <input type="radio" name="card" value="card2" checked={formData.card === 'card2'} onChange={handleChange} className="sr-only" />
                                     <span className="font-semibold text-sm">{cardNames.card2}</span>
                                 </label>
                             </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-3 flex justify-end gap-3 rounded-b-xl">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600">{expense ? 'Save Changes' : 'Add Expense'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const SettingsModal = ({ isOpen, onClose, onSaveUserId, onSaveCardNames, currentNames, currentUserId, error }) => {
    const [activeTab, setActiveTab] = useState('profile');
    
    // State for card names form
    const [cardNames, setCardNames] = useState(currentNames);
    const [cardNamesChanged, setCardNamesChanged] = useState(false);
    
    // State for user id form
    const [newCustomUserId, setNewCustomUserId] = useState(currentUserId);
    const [password, setPassword] = useState('');

    useEffect(() => {
        setCardNames(currentNames);
        setNewCustomUserId(currentUserId);
    }, [currentNames, currentUserId]);
    
    useEffect(() => {
        setCardNamesChanged(JSON.stringify(currentNames) !== JSON.stringify(cardNames));
    }, [cardNames, currentNames]);

    const handleCardNamesChange = (e) => setCardNames(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleCardNamesSubmit = (e) => { e.preventDefault(); onSaveCardNames(cardNames); };
    
    const handleUserIdSubmit = (e) => {
        e.preventDefault();
        onSaveUserId(newCustomUserId, password);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
                <div className="p-6">
                    <h2 className="text-2xl font-bold mb-4 dark:text-white">Settings</h2>
                    <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                        <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                            <button onClick={() => setActiveTab('profile')} className={`${activeTab === 'profile' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}>
                                Profile
                            </button>
                            <button onClick={() => setActiveTab('cards')} className={`${activeTab === 'cards' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}>
                                Cards
                            </button>
                        </nav>
                    </div>

                    {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

                    {activeTab === 'profile' && (
                        <form onSubmit={handleUserIdSubmit}>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Change your unique User ID. You will need to enter your current password to confirm this change.</p>
                            <div className="mb-4">
                                <label htmlFor="newCustomUserId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New User ID</label>
                                <input type="text" id="newCustomUserId" value={newCustomUserId} onChange={(e) => setNewCustomUserId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white" required />
                            </div>
                            <div className="mb-4">
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
                                <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white" required />
                            </div>
                             <div className="bg-gray-50 dark:bg-gray-700/50 -mx-6 -mb-6 px-6 py-3 flex justify-end gap-3 rounded-b-xl mt-6">
                                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                                <button type="submit" disabled={newCustomUserId === currentUserId} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-500 dark:hover:bg-indigo-600">Update User ID</button>
                            </div>
                        </form>
                    )}

                    {activeTab === 'cards' && (
                        <form onSubmit={handleCardNamesSubmit}>
                             <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Edit the names of your credit cards. These names will be used throughout the app.</p>
                            <div className="mb-4">
                                <label htmlFor="card1" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Card 1 Name</label>
                                <input type="text" name="card1" id="card1" value={cardNames.card1} onChange={handleCardNamesChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white" required />
                            </div>
                            <div className="mb-4">
                                <label htmlFor="card2" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Card 2 Name</label>
                                <input type="text" name="card2" id="card2" value={cardNames.card2} onChange={handleCardNamesChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white" required />
                            </div>
                             <div className="bg-gray-50 dark:bg-gray-700/50 -mx-6 -mb-6 px-6 py-3 flex justify-end gap-3 rounded-b-xl mt-6">
                                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                                <button type="submit" disabled={!cardNamesChanged} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-500 dark:hover:bg-indigo-600">Save Card Names</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- SVG Icons ---
const PlusIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>);
const CreditCardIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>);
const PencilIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>);
const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);
const UndoIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>);
const XCircleIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>);
const SettingsIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>);
const MoonIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>;
const SunIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>;
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
