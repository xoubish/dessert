import React, { useState, useEffect } from 'react';
import { Star, Plus, X, Check, ArrowLeft, Trophy, Upload, Trash2, RefreshCw, Sparkles } from 'lucide-react';
import {
  getVoterId,
  markVotedLocal,
  fetchDesserts,
  fetchVotes,
  saveDessert,
  saveVote,
  deleteDessertById,
} from './storage';

// ---------- Helpers ----------

const resizeImage = (file, maxDim = 900) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FAF5E8';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = e.target.result;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const avg = (arr) => arr.length ? arr.reduce((a,b) => a+b, 0) / arr.length : 0;

const romanTens = (n) => {
  // formats 1–99 to Roman (enough for entry numbers)
  const mapping = [
    [90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']
  ];
  let out = '';
  for (const [v,s] of mapping) { while (n>=v){ out+=s; n-=v; } }
  return out;
};

// ---------- Star Row ----------

const StarRow = ({ value, onChange, size = 30, readonly = false, showNumber = true }) => {
  const [hover, setHover] = useState(null);
  const display = hover !== null ? hover : value;
  return (
    <div className="flex items-center gap-1.5" onMouseLeave={() => setHover(null)}>
      {[0,1,2,3,4].map(i => {
        const fullVal = i + 1;
        const halfVal = i + 0.5;
        const filled = display >= fullVal;
        const halfFilled = display >= halfVal && display < fullVal;
        return (
          <div key={i} className="relative" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-stone-300" fill="none" strokeWidth={1.25} />
            {(filled || halfFilled) && (
              <div className="absolute inset-0 overflow-hidden" style={{ width: halfFilled ? size/2 : size }}>
                <Star size={size} className="text-amber-600" fill="currentColor" strokeWidth={1.25} />
              </div>
            )}
            {!readonly && (
              <>
                <div
                  className="absolute left-0 top-0 w-1/2 h-full cursor-pointer z-10"
                  onMouseEnter={() => setHover(halfVal)}
                  onClick={() => onChange(value === halfVal ? 0 : halfVal)}
                />
                <div
                  className="absolute right-0 top-0 w-1/2 h-full cursor-pointer z-10"
                  onMouseEnter={() => setHover(fullVal)}
                  onClick={() => onChange(value === fullVal ? 0 : fullVal)}
                />
              </>
            )}
          </div>
        );
      })}
      {showNumber && (
        <span className="ml-2 tabular-nums text-stone-600" style={{ fontSize: size * 0.55, fontFamily: 'Fraunces, serif' }}>
          {display > 0 ? display.toFixed(1) : '–'}
        </span>
      )}
    </div>
  );
};

// ---------- Main App ----------

export default function App() {
  const [desserts, setDesserts] = useState([]);
  const [votes, setVotes] = useState({});
  const [myVotes, setMyVotes] = useState({});
  const [voterId, setVoterId] = useState(null);
  const [view, setView] = useState('gallery'); // gallery | vote | admin | results
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState(null);

  // Admin via URL: ?admin=spherex
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('admin') === 'shooby') setIsAdmin(true);
    } catch {}
  }, []);

  // Fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,900;1,9..144,400;1,9..144,600&family=Caveat:wght@400;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const vid = getVoterId();
      setVoterId(vid);

      const cleanDesserts = await fetchDesserts();
      setDesserts(cleanDesserts);

      const vList = await fetchVotes();
      const byDessert = {};
      const mine = {};
      vList.forEach(v => {
        if (!byDessert[v.dessertId]) byDessert[v.dessertId] = [];
        byDessert[v.dessertId].push(v);
        if (v.voterId === vid) mine[v.dessertId] = v;
      });
      setVotes(byDessert);
      setMyVotes(mine);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const submitVote = async (dessertId, theme, flavor, comment) => {
    if (!voterId) return;
    const voteData = { dessertId, voterId, theme, flavor, comment: comment.trim(), votedAt: Date.now() };
    try {
      await saveVote(voteData);
      markVotedLocal(dessertId);
      setVotes(prev => {
        const list = (prev[dessertId] || []).filter(v => v.voterId !== voterId);
        return { ...prev, [dessertId]: [...list, voteData] };
      });
      setMyVotes(prev => ({ ...prev, [dessertId]: voteData }));
      setStatus({ type: 'success', msg: 'Vote recorded.' });
      setTimeout(() => setStatus(null), 2500);
      return true;
    } catch (err) {
      setStatus({ type: 'error', msg: 'Could not save vote. Try again.' });
      return false;
    }
  };

  const addDessert = async (data) => {
    const id = 'd_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
    const dessert = { id, ...data, createdAt: Date.now() };
    try {
      await saveDessert(dessert);
      setDesserts(prev => [...prev, dessert]);
      setStatus({ type: 'success', msg: 'Entry added.' });
      setTimeout(() => setStatus(null), 2500);
      return true;
    } catch (err) {
      setStatus({ type: 'error', msg: 'Could not save. Image might be too large.' });
      return false;
    }
  };

  const deleteDessert = async (id) => {
    if (!confirm('Delete this entry and all its votes?')) return;
    try {
      await deleteDessertById(id);
      await loadData();
    } catch {}
  };

  const selectedDessert = desserts.find(d => d.id === selectedId);
  const totalVotes = Object.values(votes).reduce((sum, arr) => sum + arr.length, 0);
  const myVoteCount = Object.keys(myVotes).length;
  const hasVotedAny = myVoteCount > 0;

  // ---------- Styles ----------
  const baseFont = "'Fraunces', Georgia, serif";
  const scriptFont = "'Caveat', cursive";

  const parchmentBg = {
    background: `
      radial-gradient(ellipse at top, rgba(184, 134, 11, 0.08), transparent 50%),
      radial-gradient(ellipse at bottom right, rgba(123, 30, 30, 0.06), transparent 60%),
      #F0E4CE
    `,
    minHeight: '100vh',
  };

  // Subtle star decorations in the background
  const StarDecor = () => (
    <svg className="fixed inset-0 pointer-events-none opacity-[0.08]" width="100%" height="100%" style={{zIndex:0}}>
      <defs>
        <pattern id="stars" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="20" r="0.8" fill="#2A1810"/>
          <circle cx="60" cy="45" r="0.5" fill="#7B1E1E"/>
          <circle cx="95" cy="85" r="0.7" fill="#2A1810"/>
          <circle cx="30" cy="90" r="0.4" fill="#7B1E1E"/>
          <circle cx="80" cy="15" r="0.6" fill="#2A1810"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#stars)"/>
    </svg>
  );

  // ---------- Loading ----------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{...parchmentBg, fontFamily: baseFont}}>
        <div className="text-stone-700 text-lg italic">Preparing the ballot…</div>
      </div>
    );
  }

  // ---------- Vote View ----------
  if (view === 'vote' && selectedDessert) {
    return <VotePage
      dessert={selectedDessert}
      existingVote={myVotes[selectedDessert.id]}
      votes={votes[selectedDessert.id] || []}
      onSubmit={submitVote}
      onBack={() => { setView('gallery'); setSelectedId(null); }}
      baseFont={baseFont}
      scriptFont={scriptFont}
      parchmentBg={parchmentBg}
    />;
  }

  // ---------- Results View ----------
  if (view === 'results') {
    return <ResultsPage
      desserts={desserts}
      votes={votes}
      myVotes={myVotes}
      onBack={() => setView('gallery')}
      baseFont={baseFont}
      scriptFont={scriptFont}
      parchmentBg={parchmentBg}
    />;
  }

  // ---------- Admin View ----------
  if (view === 'admin' && isAdmin) {
    return <AdminPage
      desserts={desserts}
      votes={votes}
      onAdd={addDessert}
      onDelete={deleteDessert}
      onBack={() => setView('gallery')}
      onRefresh={loadData}
      baseFont={baseFont}
      scriptFont={scriptFont}
      parchmentBg={parchmentBg}
    />;
  }

  // ---------- Gallery ----------
  return (
    <div style={{ ...parchmentBg, fontFamily: baseFont }} className="relative">
      <StarDecor />
      <div className="relative max-w-6xl mx-auto px-5 py-10 md:py-14" style={{zIndex:1}}>
        {/* Header */}
        <header className="text-center mb-12">
          <div className="text-xs tracking-[0.4em] text-stone-600 uppercase mb-4">
            IPAC
          </div>
          <div className="flex items-center justify-center gap-4 mb-2">
            <div className="h-px w-16 bg-stone-500"></div>
            <Sparkles size={20} className="text-amber-700"/>
            <div className="h-px w-16 bg-stone-500"></div>
          </div>
          <h1 style={{fontFamily: baseFont, fontOpticalSizing: 'auto'}}
              className="text-5xl md:text-7xl font-medium leading-tight tracking-tight"
              >
            <span style={{color:'#2A1810'}}>Annual Dessert</span>
            <br/>
            <span style={{color:'#7B1E1E', fontStyle:'italic'}}>Bake-Off</span>
          </h1>
          <div style={{fontFamily: scriptFont, color:'#B8860B'}} className="text-3xl md:text-4xl mt-2">
            Forty &amp; Festive
          </div>
          <div className="text-sm tracking-[0.25em] text-stone-600 uppercase mt-4">
            MCMLXXXVI · — · MMXXVI
          </div>
          <div className="text-sm text-stone-500 italic mt-1">
            April 28, 2026 · Tournament Park
          </div>
        </header>

        {/* Intro / instructions */}
        <div className="max-w-2xl mx-auto text-center mb-10">
          <p className="text-stone-700 text-lg leading-relaxed italic" style={{fontFamily: baseFont}}>
            The official judges will render their verdict. But so shall the crowd.
            Tap each entry, taste honestly, rate with care.
          </p>
          <p className="text-stone-600 text-sm mt-3">
            Theme and flavor rated independently · half-stars allowed · one ballot per device
          </p>
        </div>

        {/* Stats strip */}
        <div className="flex justify-center gap-8 md:gap-16 mb-10 py-4 border-y border-stone-400/50">
          <Stat label="Entries" value={desserts.length} scriptFont={scriptFont}/>
          <Stat label="Ballots Cast" value={totalVotes} scriptFont={scriptFont}/>
          <Stat label="Yours" value={`${myVoteCount}/${desserts.length}`} scriptFont={scriptFont}/>
        </div>

        {/* Buttons row */}
        {(hasVotedAny || isAdmin) && (
          <div className="flex justify-center gap-3 mb-8 flex-wrap">
            {hasVotedAny && (
              <button
                onClick={() => setView('results')}
                className="px-5 py-2 border-2 border-amber-700 text-amber-800 hover:bg-amber-700 hover:text-amber-50 transition-all rounded-sm flex items-center gap-2 text-sm tracking-wider uppercase"
              >
                <Trophy size={16}/> See the People's Verdict
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setView('admin')}
                className="px-5 py-2 border-2 border-stone-600 text-stone-700 hover:bg-stone-700 hover:text-stone-50 transition-all rounded-sm flex items-center gap-2 text-sm tracking-wider uppercase"
              >
                <Plus size={16}/> Manage Entries
              </button>
            )}
          </div>
        )}

        {/* Gallery */}
        {desserts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-stone-500 italic text-lg">No entries yet.</div>
            {isAdmin && (
              <button onClick={() => setView('admin')} className="mt-6 px-6 py-3 bg-red-900 text-amber-50 hover:bg-red-800 rounded-sm tracking-wider uppercase text-sm">
                Add the First Entry
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {desserts.map((d, idx) => (
              <DessertCard
                key={d.id}
                dessert={d}
                index={idx+1}
                voteCount={(votes[d.id] || []).length}
                myVote={myVotes[d.id]}
                onClick={() => { setSelectedId(d.id); setView('vote'); }}
                baseFont={baseFont}
                scriptFont={scriptFont}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="text-center mt-20 pt-8 border-t border-stone-400/40">
          <div className="text-stone-500 text-xs tracking-[0.3em] uppercase">
            ★ &nbsp; Forty Years of Photons &nbsp; ★
          </div>
          <div className="text-stone-400 text-xs mt-2 italic">
            A people's ballot for the IPAC bake-off · vote early, vote honestly
          </div>
        </footer>

        {/* Toast */}
        {status && (
          <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-sm shadow-lg text-sm tracking-wider uppercase z-50 ${
            status.type === 'success' ? 'bg-green-900 text-amber-50' : 'bg-red-900 text-amber-50'
          }`}>
            {status.msg}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Subcomponents ----------

const Stat = ({ label, value, scriptFont }) => (
  <div className="text-center">
    <div style={{fontFamily: scriptFont, color: '#7B1E1E'}} className="text-4xl leading-none">{value}</div>
    <div className="text-xs tracking-[0.25em] text-stone-600 uppercase mt-1">{label}</div>
  </div>
);

const DessertCard = ({ dessert, index, voteCount, myVote, onClick, baseFont, scriptFont }) => {
  const hasVoted = !!myVote;
  return (
    <button
      onClick={onClick}
      className="group text-left bg-[#FAF5E8] border border-stone-400/60 rounded-sm overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
      style={{ boxShadow: '0 2px 8px rgba(42, 24, 16, 0.08)' }}
    >
      <div className="relative aspect-[4/3] bg-stone-200 overflow-hidden">
        {dessert.imageData ? (
          <img src={dessert.imageData} alt={dessert.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400 italic">no image</div>
        )}
        <div className="absolute top-3 right-3 bg-[#FAF5E8] border border-stone-500/60 px-2.5 py-1 rounded-sm">
          <span className="text-xs tracking-[0.25em] text-stone-700">N<sup>o</sup> {String(index).padStart(2,'0')}</span>
        </div>
      </div>
      <div className="p-5">
        <h3 style={{fontFamily: baseFont, color: '#2A1810'}} className="text-xl font-semibold leading-tight mb-1">
          {dessert.name}
        </h3>
        <div style={{fontFamily: scriptFont, color:'#7B1E1E'}} className="text-xl leading-tight mb-3">
          by {dessert.baker}
        </div>
        <div className="pt-3 border-t border-stone-300/80 flex items-center justify-between">
          {hasVoted ? (
            <div className="flex items-center gap-2 text-xs text-stone-600">
              <Check size={14} className="text-green-800"/>
              <span className="tracking-wider uppercase">Your ballot cast</span>
            </div>
          ) : (
            <div className="text-xs tracking-[0.2em] uppercase text-amber-800 font-medium">
              Tap to rate →
            </div>
          )}
          <div className="text-xs text-stone-500 italic">
            {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
          </div>
        </div>
      </div>
    </button>
  );
};

// ---------- Vote Page ----------
const VotePage = ({ dessert, existingVote, votes, onSubmit, onBack, baseFont, scriptFont, parchmentBg }) => {
  const [theme, setTheme] = useState(existingVote?.theme ?? 0);
  const [flavor, setFlavor] = useState(existingVote?.flavor ?? 0);
  const [comment, setComment] = useState(existingVote?.comment ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (theme === 0 && flavor === 0 && !comment.trim()) return;
    setSubmitting(true);
    const ok = await onSubmit(dessert.id, theme, flavor, comment);
    setSubmitting(false);
    if (ok) {
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 2500);
    }
  };

  const crowdTheme = votes.length ? avg(votes.map(v => v.theme)) : 0;
  const crowdFlavor = votes.length ? avg(votes.map(v => v.flavor)) : 0;
  const showResults = !!existingVote;

  return (
    <div style={{ ...parchmentBg, fontFamily: baseFont }} className="min-h-screen">
      <div className="max-w-3xl mx-auto px-5 py-8">
        <button onClick={onBack} className="flex items-center gap-2 text-stone-700 hover:text-red-900 mb-6 text-sm tracking-wider uppercase">
          <ArrowLeft size={16}/> Back to entries
        </button>

        <div className="bg-[#FAF5E8] border border-stone-400/60 rounded-sm overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(42, 24, 16, 0.1)' }}>
          <div className="aspect-[16/10] bg-stone-200 overflow-hidden">
            {dessert.imageData ? (
              <img src={dessert.imageData} alt={dessert.name} className="w-full h-full object-cover"/>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-400 italic">no image</div>
            )}
          </div>
          <div className="p-6 md:p-10">
            <h1 style={{color: '#2A1810'}} className="text-3xl md:text-4xl font-semibold leading-tight mb-2">
              {dessert.name}
            </h1>
            <div style={{fontFamily: scriptFont, color:'#7B1E1E'}} className="text-2xl mb-6">
              by {dessert.baker}
            </div>
            {dessert.description && (
              <p className="text-stone-700 leading-relaxed italic text-lg mb-8 pb-8 border-b border-stone-300">
                {dessert.description}
              </p>
            )}

            {/* Rating */}
            <div className="space-y-8">
              <RatingBlock label="Theme" sub="How well does it evoke Forty & Festive?"
                value={theme} onChange={setTheme} baseFont={baseFont}/>
              <RatingBlock label="Flavor" sub="Does it taste as good as it looks?"
                value={flavor} onChange={setFlavor} baseFont={baseFont}/>

              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <label className="text-sm tracking-[0.25em] uppercase text-stone-700 font-medium">Notes</label>
                  <span className="text-xs italic text-stone-500">optional, encouraged</span>
                </div>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Any thoughts? Write a little review — like you're telling a friend why this one stuck with you."
                  className="w-full h-28 px-4 py-3 bg-[#F0E4CE] border border-stone-400/70 rounded-sm focus:border-amber-700 focus:outline-none text-stone-800 italic"
                  style={{fontFamily: baseFont}}
                  maxLength={500}
                />
                <div className="text-xs text-stone-500 text-right mt-1">{comment.length}/500</div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || (theme === 0 && flavor === 0 && !comment.trim())}
                className="w-full py-4 bg-red-900 hover:bg-red-800 disabled:bg-stone-400 disabled:cursor-not-allowed text-amber-50 tracking-[0.3em] uppercase text-sm transition-colors rounded-sm"
              >
                {submitting ? 'Saving…' : justSubmitted ? 'Thank you ✓' : existingVote ? 'Update Ballot' : 'Cast Ballot'}
              </button>
            </div>

            {/* Crowd averages — only after voting */}
            {showResults && votes.length > 0 && (
              <div className="mt-10 pt-8 border-t border-stone-300">
                <div style={{fontFamily: scriptFont, color:'#B8860B'}} className="text-2xl mb-4">the crowd so far…</div>
                <div className="space-y-3">
                  <CrowdRow label="Theme" value={crowdTheme}/>
                  <CrowdRow label="Flavor" value={crowdFlavor}/>
                  <div className="text-xs text-stone-500 italic mt-2">
                    based on {votes.length} {votes.length === 1 ? 'ballot' : 'ballots'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const RatingBlock = ({ label, sub, value, onChange, baseFont }) => (
  <div>
    <div className="flex items-baseline justify-between mb-3">
      <div>
        <div className="text-sm tracking-[0.25em] uppercase text-stone-700 font-medium">{label}</div>
        <div className="text-xs italic text-stone-500 mt-0.5">{sub}</div>
      </div>
    </div>
    <StarRow value={value} onChange={onChange} size={36}/>
  </div>
);

const CrowdRow = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <div className="text-sm tracking-[0.2em] uppercase text-stone-600">{label}</div>
    <StarRow value={value} onChange={()=>{}} size={22} readonly/>
  </div>
);

// ---------- Results Page ----------
const ResultsPage = ({ desserts, votes, myVotes, onBack, baseFont, scriptFont, parchmentBg }) => {
  const rows = desserts.map(d => {
    const list = votes[d.id] || [];
    const themeAvg = list.length ? avg(list.map(v => v.theme)) : 0;
    const flavorAvg = list.length ? avg(list.map(v => v.flavor)) : 0;
    return {
      ...d,
      themeAvg,
      flavorAvg,
      combined: (themeAvg + flavorAvg) / 2,
      voteCount: list.length,
      comments: list.filter(v => v.comment).map(v => v.comment),
    };
  }).sort((a,b) => b.combined - a.combined);

  return (
    <div style={{...parchmentBg, fontFamily: baseFont}} className="min-h-screen">
      <div className="max-w-4xl mx-auto px-5 py-10">
        <button onClick={onBack} className="flex items-center gap-2 text-stone-700 hover:text-red-900 mb-8 text-sm tracking-wider uppercase">
          <ArrowLeft size={16}/> Back to entries
        </button>

        <div className="text-center mb-10">
          <div className="text-xs tracking-[0.4em] text-stone-600 uppercase mb-2">The People's Verdict</div>
          <h1 style={{color:'#7B1E1E', fontStyle:'italic'}} className="text-5xl font-medium">
            Standings
          </h1>
          <div style={{fontFamily: scriptFont, color:'#B8860B'}} className="text-2xl mt-2">
            ranked by combined theme &amp; flavor
          </div>
        </div>

        <div className="space-y-4">
          {rows.map((r, i) => (
            <div key={r.id} className="bg-[#FAF5E8] border border-stone-400/60 rounded-sm p-5 flex gap-5 items-start">
              <div className="flex-shrink-0 text-center w-14">
                <div style={{fontFamily: scriptFont, color: i===0 ? '#B8860B' : i===1 ? '#7B1E1E' : '#2A1810'}} className="text-5xl leading-none">
                  {i+1}
                </div>
                {i < 3 && (
                  <div className="text-xs tracking-widest uppercase mt-1" style={{color: i===0 ? '#B8860B' : '#7B1E1E'}}>
                    {['Gold','Silver','Bronze'][i]}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 w-20 h-20 bg-stone-200 rounded-sm overflow-hidden">
                {r.imageData && <img src={r.imageData} alt={r.name} className="w-full h-full object-cover"/>}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{color:'#2A1810'}} className="text-lg font-semibold leading-tight">{r.name}</div>
                <div style={{fontFamily: scriptFont, color:'#7B1E1E'}} className="text-lg leading-tight">by {r.baker}</div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-stone-600">
                  <span>Theme <strong style={{fontFamily: scriptFont, color:'#B8860B', fontSize:'1.3em'}}>{r.themeAvg.toFixed(2)}</strong></span>
                  <span>Flavor <strong style={{fontFamily: scriptFont, color:'#B8860B', fontSize:'1.3em'}}>{r.flavorAvg.toFixed(2)}</strong></span>
                  <span className="italic">{r.voteCount} {r.voteCount===1?'ballot':'ballots'}</span>
                </div>
                {r.comments.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-amber-800 text-xs tracking-wider uppercase">
                      read {r.comments.length} {r.comments.length===1?'note':'notes'}
                    </summary>
                    <ul className="mt-2 space-y-2 pl-4">
                      {r.comments.map((c,ci) => (
                        <li key={ci} className="text-stone-700 italic border-l-2 border-amber-700/40 pl-3">"{c}"</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------- Admin Page ----------
const AdminPage = ({ desserts, votes, onAdd, onDelete, onBack, onRefresh, baseFont, scriptFont, parchmentBg }) => {
  const [name, setName] = useState('');
  const [baker, setBaker] = useState('');
  const [description, setDescription] = useState('');
  const [imageData, setImageData] = useState(null);
  const [imageName, setImageName] = useState('');
  const [saving, setSaving] = useState(false);
  const [imageErr, setImageErr] = useState(null);

  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageErr(null);
    if (!file.type.startsWith('image/')) {
      setImageErr('Please choose an image file.');
      return;
    }
    try {
      const resized = await resizeImage(file);
      setImageData(resized);
      setImageName(file.name);
    } catch {
      setImageErr('Could not process that image.');
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || !baker.trim()) return;
    setSaving(true);
    const ok = await onAdd({
      name: name.trim(),
      baker: baker.trim(),
      description: description.trim(),
      imageData: imageData,
    });
    setSaving(false);
    if (ok) {
      setName(''); setBaker(''); setDescription(''); setImageData(null); setImageName('');
    }
  };

  return (
    <div style={{...parchmentBg, fontFamily: baseFont}} className="min-h-screen">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="flex items-center gap-2 text-stone-700 hover:text-red-900 text-sm tracking-wider uppercase">
            <ArrowLeft size={16}/> Back
          </button>
          <button onClick={onRefresh} className="flex items-center gap-2 text-stone-600 hover:text-red-900 text-sm tracking-wider uppercase">
            <RefreshCw size={14}/> Refresh
          </button>
        </div>

        <h1 style={{color:'#7B1E1E'}} className="text-4xl font-semibold italic mb-2">Manage Entries</h1>
        <p className="text-stone-600 text-sm italic mb-8">Add each dessert as it arrives. Keep images under ~3MB.</p>

        <div className="bg-[#FAF5E8] border border-stone-400/60 rounded-sm p-6 mb-10 space-y-4">
          <div>
            <label className="text-xs tracking-[0.25em] uppercase text-stone-700 block mb-2">Dessert Name</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2 bg-[#F0E4CE] border border-stone-400/70 rounded-sm focus:border-amber-700 focus:outline-none"
              placeholder="e.g. Cardamom-Walnut Shortbread Pie"
              style={{fontFamily: baseFont}}
            />
          </div>
          <div>
            <label className="text-xs tracking-[0.25em] uppercase text-stone-700 block mb-2">Baker</label>
            <input
              value={baker} onChange={e => setBaker(e.target.value)}
              className="w-full px-4 py-2 bg-[#F0E4CE] border border-stone-400/70 rounded-sm focus:border-amber-700 focus:outline-none"
              placeholder="e.g. Shooby"
              style={{fontFamily: baseFont}}
            />
          </div>
          <div>
            <label className="text-xs tracking-[0.25em] uppercase text-stone-700 block mb-2">Description <span className="text-stone-500 normal-case tracking-normal italic">(optional)</span></label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              className="w-full h-24 px-4 py-2 bg-[#F0E4CE] border border-stone-400/70 rounded-sm focus:border-amber-700 focus:outline-none italic"
              placeholder="A line or two about what it is, flavors, theme tie-in…"
              style={{fontFamily: baseFont}}
            />
          </div>
          <div>
            <label className="text-xs tracking-[0.25em] uppercase text-stone-700 block mb-2">Photo</label>
            <div className="flex items-center gap-3">
              <label className="px-4 py-2 bg-stone-700 text-amber-50 rounded-sm cursor-pointer hover:bg-stone-800 transition-colors tracking-wider uppercase text-xs flex items-center gap-2">
                <Upload size={14}/>
                Choose
                <input type="file" accept="image/*" onChange={handleImage} className="hidden"/>
              </label>
              {imageName && <span className="text-sm text-stone-700 italic truncate">{imageName}</span>}
              {imageData && (
                <img src={imageData} alt="" className="w-16 h-16 object-cover rounded-sm border border-stone-400"/>
              )}
            </div>
            {imageErr && <div className="text-sm text-red-800 mt-2">{imageErr}</div>}
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !name.trim() || !baker.trim()}
            className="w-full py-3 bg-red-900 hover:bg-red-800 disabled:bg-stone-400 text-amber-50 tracking-[0.3em] uppercase text-sm rounded-sm transition-colors"
          >
            {saving ? 'Saving…' : '+ Add Entry'}
          </button>
        </div>

        {/* Existing list */}
        <h2 style={{color:'#2A1810'}} className="text-2xl font-semibold mb-4">Current entries ({desserts.length})</h2>
        <div className="space-y-3">
          {desserts.map((d, i) => (
            <div key={d.id} className="flex items-center gap-4 bg-[#FAF5E8] border border-stone-400/60 rounded-sm p-3">
              <div className="w-14 h-14 bg-stone-200 rounded-sm overflow-hidden flex-shrink-0">
                {d.imageData && <img src={d.imageData} alt="" className="w-full h-full object-cover"/>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-stone-800 truncate">N<sup>o</sup> {String(i+1).padStart(2,'0')} · {d.name}</div>
                <div style={{fontFamily: scriptFont, color:'#7B1E1E'}} className="text-lg leading-none">by {d.baker}</div>
                <div className="text-xs text-stone-500 italic">{(votes[d.id] || []).length} ballots</div>
              </div>
              <button onClick={() => onDelete(d.id)} className="p-2 text-red-900 hover:bg-red-100 rounded-sm" title="Delete">
                <Trash2 size={16}/>
              </button>
            </div>
          ))}
          {desserts.length === 0 && (
            <div className="text-stone-500 italic text-center py-8">No entries yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};
