import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, onSnapshot, query, serverTimestamp } from 'firebase/firestore';

// --- Helper Functions & Constants ---
const CARD_1_NAME = 'ICICI Amazon Pay';
const CARD_2_NAME = 'ICICI Coral RuPay';

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

    // Firebase state
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
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

            const unsubscribe = onAuthStateChanged(authInstance, (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    setUserId(null);
                    // Clear user data on logout
                    setExpenses([]);
                    setRecycleBin([]);
                }
                setIsAuthReady(true);
                setIsLoading(false); // Stop loading once auth state is determined
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
            // If user logs out, we should not proceed.
            if (!userId) setIsLoading(false);
            return;
        }

        setIsLoading(true);

        // Fetch active expenses
        const expensesPath = `users/${userId}/expenses`;
        const qExpenses = query(collection(db, expensesPath));
        const unsubscribeExpenses = onSnapshot(qExpenses, (querySnapshot) => {
            const expensesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by date in descending order (newest first)
            expensesData.sort((a, b) => new Date(b.date) - new Date(a.date));
            setExpenses(expensesData);
            setIsLoading(false);
        }, (err) => {
            console.error("Error fetching expenses:", err);
            setError("Could not fetch expenses.");
            setIsLoading(false);
        });

        // Fetch recycled expenses
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
    }, [isAuthReady, db, userId]);

    // --- Auth Handlers ---
    const handleSignUp = async (email, password) => {
        setError('');
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError(err.message);
            console.error("Sign up error:", err);
        }
    };

    const handleLogin = async (email, password) => {
        setError('');
        try {
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
            await addDoc(collection(db, expensesPath), {
                ...expense,
                createdAt: serverTimestamp(),
            });
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

    const handleRestoreExpense = async (expense) => {
        if (!db || !userId) return;
        const expenseRef = doc(db, `/users/${userId}/expenses`, expense.id);
        const binRef = doc(db, `/users/${userId}/recycleBin`, expense.id);
        try {
            await setDoc(expenseRef, expense);
            await deleteDoc(binRef);
        } catch (e) {
            console.error("Error restoring expense: ", e);
            setError("Failed to restore expense.");
        }
    };

    const handlePermanentDelete = async (id) => {
        if (!db || !userId) return;
        if (window.confirm("Are you sure you want to permanently delete this item? This action cannot be undone.")) {
            const binRef = doc(db, `/users/${userId}/recycleBin`, id);
            try {
                await deleteDoc(binRef);
            } catch (e) {
                console.error("Error permanently deleting: ", e);
                setError("Failed to permanently delete expense.");
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
        const card1Total = expenses
            .filter(e => e.card === CARD_1_NAME)
            .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
        const card2Total = expenses
            .filter(e => e.card === CARD_2_NAME)
            .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
        return {
            [CARD_1_NAME]: card1Total,
            [CARD_2_NAME]: card2Total,
            total: card1Total + card2Total,
        };
    }, [expenses]);

    // --- Render Logic ---
    if (!isAuthReady) {
        return (
            <div className="bg-gray-100 min-h-screen flex items-center justify-center">
                <p>Loading application...</p>
            </div>
        );
    }

    if (!userId) {
        return <LoginScreen onLogin={handleLogin} onSignUp={handleSignUp} onAnonymous={handleAnonymousSignIn} error={error} />;
    }

    return (
        <div className="bg-gray-100 min-h-screen font-sans text-gray-800 p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <Header userId={userId} onLogout={handleLogout} />
                <main>
                    <SummaryCards totals={totals} />
                    <NavBar currentView={currentView} setCurrentView={setCurrentView} onAddNew={() => openModal()} />
                    
                    {error && <p className="text-red-500 bg-red-100 p-3 rounded-lg my-4 text-center">{error}</p>}
                    
                    {isLoading ? (
                        <div className="text-center p-10">
                            <p>Loading your expenses...</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mt-4">
                            {currentView === 'expenses' ? (
                                <ExpenseList expenses={expenses} onEdit={openModal} onDelete={handleDeleteExpense} />
                            ) : (
                                <RecycleBin bin={recycleBin} onRestore={handleRestoreExpense} onDelete={handlePermanentDelete} />
                            )}
                        </div>
                    )}
                </main>
            </div>
            {isModalOpen && (
                <ExpenseModal
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    onSave={editingExpense ? handleUpdateExpense : handleAddExpense}
                    expense={editingExpense}
                />
            )}
        </div>
    );
}

// --- Sub-components ---

const LoginScreen = ({ onLogin, onSignUp, onAnonymous, error }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e, handler) => {
        e.preventDefault();
        if (!email || !password) {
            alert("Please enter both email and password.");
            return;
        }
        handler(email, password);
    };

    return (
        <div className="bg-gray-100 min-h-screen flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <header className="mb-6 text-center">
                    <h1 className="text-4xl font-bold text-indigo-600">Expense Tracker</h1>
                    <p className="text-gray-500 mt-1">Sign in to continue</p>
                </header>
                <div className="bg-white p-8 rounded-xl shadow-lg">
                    <form onSubmit={(e) => handleSubmit(e, onLogin)}>
                        <div className="mb-4">
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="you@example.com"
                                required
                            />
                        </div>
                        <div className="mb-6">
                            <label htmlFor="password"className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
                        <div className="flex flex-col gap-3">
                           <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                                Login
                            </button>
                             <button type="button" onClick={(e) => handleSubmit(e, onSignUp)} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                                Sign Up
                            </button>
                        </div>
                    </form>
                    <div className="my-6 flex items-center">
                        <div className="flex-grow border-t border-gray-300"></div>
                        <span className="mx-4 text-sm text-gray-500">OR</span>
                        <div className="flex-grow border-t border-gray-300"></div>
                    </div>
                    <button onClick={onAnonymous} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors">
                        Continue Anonymously
                    </button>
                </div>
            </div>
        </div>
    );
};

const Header = ({ userId, onLogout }) => (
    <header className="mb-6">
        <div className="flex justify-between items-start">
            <div className="text-center flex-1">
                 <h1 className="text-4xl font-bold text-indigo-600">Expense Tracker</h1>
                 <p className="text-gray-500 mt-1">Log and manage your credit card expenses with ease.</p>
                 {userId && <p className="text-xs text-gray-400 mt-2 break-all">User ID: {userId}</p>}
            </div>
            <button onClick={onLogout} className="ml-4 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-3 rounded-lg text-sm transition-colors">
                Logout
            </button>
        </div>
    </header>
);

const SummaryCards = ({ totals }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-500">{CARD_1_NAME}</h3>
            <p className="text-2xl font-bold text-blue-600">₹{totals[CARD_1_NAME].toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-500">{CARD_2_NAME}</h3>
            <p className="text-2xl font-bold text-green-600">₹{totals[CARD_2_NAME].toFixed(2)}</p>
        </div>
        <div className="bg-indigo-600 text-white p-4 rounded-xl shadow-md">
            <h3 className="text-sm font-semibold text-indigo-200">Total Expenses</h3>
            <p className="text-2xl font-bold">₹{totals.total.toFixed(2)}</p>
        </div>
    </div>
);

const NavBar = ({ currentView, setCurrentView, onAddNew }) => (
    <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-2 rounded-xl shadow-md mb-4 gap-2">
        <div className="flex bg-gray-200 p-1 rounded-lg">
            <button onClick={() => setCurrentView('expenses')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${currentView === 'expenses' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600'}`}>
                Active Expenses
            </button>
            <button onClick={() => setCurrentView('bin')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${currentView === 'bin' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600'}`}>
                Recycle Bin
            </button>
        </div>
        <button onClick={onAddNew} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-transform transform hover:scale-105">
            <PlusIcon /> Add New Expense
        </button>
    </div>
);

const ExpenseList = ({ expenses, onEdit, onDelete }) => {
    if (expenses.length === 0) {
        return <p className="text-center text-gray-500 py-8">No expenses yet. Add one to get started!</p>;
    }
    return (
        <div className="space-y-3">
            {expenses.map(expense => (
                <div key={expense.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${expense.card === CARD_1_NAME ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                            <CreditCardIcon />
                        </div>
                        <div>
                            <p className="font-bold text-lg">₹{parseFloat(expense.amount).toFixed(2)}</p>
                            <p className="text-sm text-gray-600">{expense.description || 'No description'}</p>
                            <p className="text-xs text-gray-400">{new Date(expense.date).toLocaleDateString()} &bull; {expense.card}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => onEdit(expense)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-200 rounded-full transition-colors"><PencilIcon /></button>
                        <button onClick={() => onDelete(expense)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-200 rounded-full transition-colors"><TrashIcon /></button>
                    </div>
                </div>
            ))}
        </div>
    );
};

const RecycleBin = ({ bin, onRestore, onDelete }) => {
    if (bin.length === 0) {
        return <p className="text-center text-gray-500 py-8">Recycle bin is empty.</p>;
    }
    return (
        <div className="space-y-3">
            {bin.map(expense => (
                <div key={expense.id} className="flex items-center justify-between bg-red-50 p-3 rounded-lg">
                    <div className="flex-1">
                        <p className="font-bold">₹{parseFloat(expense.amount).toFixed(2)}</p>
                        <p className="text-sm text-gray-600">{expense.description || 'No description'}</p>
                        <p className="text-xs text-gray-400">{new Date(expense.date).toLocaleDateString()} &bull; {expense.card}</p>
                    </div>
                    <div className="flex items-center gap-2">
                         <button onClick={() => onRestore(expense)} className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-100 rounded-full transition-colors"><UndoIcon /></button>
                        <button onClick={() => onDelete(expense.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"><XCircleIcon /></button>
                    </div>
                </div>
            ))}
        </div>
    );
};

const ExpenseModal = ({ isOpen, onClose, onSave, expense }) => {
    const [formData, setFormData] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        card: CARD_1_NAME
    });

    useEffect(() => {
        if (expense) {
            setFormData({
                id: expense.id,
                amount: expense.amount,
                date: expense.date,
                description: expense.description || '',
                card: expense.card,
            });
        } else {
             setFormData({
                amount: '',
                date: new Date().toISOString().split('T')[0],
                description: '',
                card: CARD_1_NAME
            });
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
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <h2 className="text-2xl font-bold mb-4">{expense ? 'Edit Expense' : 'Add New Expense'}</h2>
                        <div className="mb-4">
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                            <input type="number" name="amount" id="amount" value={formData.amount} onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="0.00" step="0.01" required />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                            <input type="date" name="date" id="date" value={formData.date} onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" required />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                            <input type="text" name="description" id="description" value={formData.description} onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="e.g., Coffee, Groceries" />
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-gray-700 mb-2">Card</label>
                             <div className="flex gap-4">
                                 <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center ${formData.card === CARD_1_NAME ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                                     <input type="radio" name="card" value={CARD_1_NAME} checked={formData.card === CARD_1_NAME} onChange={handleChange} className="sr-only" />
                                     <span className="font-semibold text-sm">{CARD_1_NAME}</span>
                                 </label>
                                 <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center ${formData.card === CARD_2_NAME ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                                     <input type="radio" name="card" value={CARD_2_NAME} checked={formData.card === CARD_2_NAME} onChange={handleChange} className="sr-only" />
                                     <span className="font-semibold text-sm">{CARD_2_NAME}</span>
                                 </label>
                             </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-6 py-3 flex justify-end gap-3 rounded-b-xl">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">{expense ? 'Save Changes' : 'Add Expense'}</button>
                    </div>
                </form>
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