import { useState, useEffect } from 'react';

function History({ onBack }) {
  const [history, setHistory] = useState<{ roomId: string; score: number; won: boolean; playedAt: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      setLoading(false);
      return;
    }

    fetch('http://localhost:8080/my-history', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setHistory(data);
        setLoading(false);
      })
      .catch(err => {
        console.log(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-4 text-center">My history</h2>

        {loading && <p className="text-center text-gray-500">Loading...</p>}

        {!loading && history.length === 0 && (
          <p className="text-center text-gray-500">no history found</p>
        )}

        {history.map((h, i) => (
          <div key={i} className="border-b border-gray-200 py-2">
            <p className="text-sm">Room: {h.roomId}</p>
            <p className="text-sm">Score: {h.score} {h.won && <span className="text-green-600 font-bold">🏆win !</span>}</p>
            <p className="text-xs text-gray-400">{new Date(h.playedAt).toLocaleDateString()}</p>
          </div>
        ))}

        <button 
          className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded mt-4"
          onClick={onBack}
        >
           Go back
        </button>
      </div>
    </div>
  );
}

export default History;