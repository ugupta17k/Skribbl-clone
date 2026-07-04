import { useState } from 'react';

function Auth({ onLoginSuccess, onSkip }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit() {
    setErrorMsg('');

    if (!username || !password) {
      setErrorMsg('fill up credentials');
      return;
    }

    const endpoint = isRegisterMode ? 'register' : 'login';

    try {
      const res = await fetch(`http://localhost:8080/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error);
        return;
      }

      localStorage.setItem('token', data.token);

      onLoginSuccess(data.username);

    } catch (err) {
      console.log(err);
      setErrorMsg('Server not connected');
    }
  }

  return (
    <div className="min-h-screen flex  flex-col items-center justify-center bg-gray-100">
      <div className='mb-10'>
      <h1 className='text-4xl font-bold'>Welcome to skribbl</h1>
      </div>
      <div className="bg-white rounded-xl p-8 rounded-lg shadow-md w-96 text-center">
        <h1 className="text-2xl font-bold mb-4">
          {isRegisterMode ? 'Register Karo' : 'Login Karo'}
        </h1>

        <input
          className="w-full border rounded-xl border-gray-300 rounded px-3 py-2 mb-3"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          className="w-full rounded-xl border border-gray-300 rounded px-3 py-2 mb-3"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {errorMsg && (
          <p className="text-red-500 text-sm mb-3">{errorMsg}</p>
        )}

        <button
          className="w-full rounded-xl bg-blue-500 hover:bg-black text-white cursor-pointer py-2 rounded mb-3"
          onClick={handleSubmit}
        >
          {isRegisterMode ? 'Register' : 'Login'}
        </button>

        <p className="text-sm text-gray-600 mb-3">
          {isRegisterMode ? 'Already exist account' : 'New account'}{' '}
          <span
            className="text-blue-500 cursor-pointer underline"
            onClick={() => setIsRegisterMode(!isRegisterMode)}
          >
            {isRegisterMode ? 'Login' : 'Register'}
          </span>
        </p>

        <button
          className="w-full rounded-xl bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded"
          onClick={onSkip}
        >
          <b>Play game</b>
        </button>
      </div>
    </div>
  );
}

export default Auth;