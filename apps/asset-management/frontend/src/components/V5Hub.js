import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';

const API_URL = process.env.REACT_APP_API_URL || '/api';

export default function V5Hub({ token, userRole }) {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [stock, setStock] = useState([]);
  const [results, setResults] = useState([]);
  const [q, setQ] = useState('');
  const [security, setSecurity] = useState(null);
  const [setup, setSetup] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const admin = ['admin','super_admin'].includes(userRole);
  const headers = useMemo(() => ({Authorization:`Bearer ${token}`}), [token]);

  const load = async () => {
    try {
      const [d,t,s,sec] = await Promise.all([
        axios.get(`${API_URL}/v5/dashboard`,{headers}),
        axios.get(`${API_URL}/v5/tickets`,{headers}),
        axios.get(`${API_URL}/v5/stock`,{headers}),
        axios.get(`${API_URL}/v5/security/me`,{headers})
      ]);
      setData(d.data); setTickets(t.data); setStock(s.data); setSecurity(sec.data);
    } catch(e) { setMessage(e.response?.data?.detail || 'Unable to load V5 data'); }
  };
  useEffect(()=>{load();},[token]);

  const search = async (value) => {
    setQ(value); if (!value.trim()) return setResults([]);
    try { const r=await axios.get(`${API_URL}/v5/search`,{params:{q:value},headers}); setResults(r.data); } catch(e) {}
  };

  const start2FA = async () => {
    setBusy(true); setMessage('');
    try { const r=await axios.post(`${API_URL}/v5/security/setup`,{}, {headers}); setSetup(r.data); }
    catch(e){setMessage(e.response?.data?.detail||'2FA setup failed');} finally {setBusy(false);}
  };
  const verify2FA = async (code) => {
    try { await axios.post(`${API_URL}/v5/security/verify`,{code},{headers}); setMessage('Two-factor authentication enabled.'); setSetup(null); load(); }
    catch(e){setMessage(e.response?.data?.detail||'Invalid code');}
  };
  const createTicket = async () => {
    const title=window.prompt('Ticket title'); if(!title) return;
    try { await axios.post(`${API_URL}/v5/tickets`,{title,description:'Created from APEX V5'}, {headers}); load(); }
    catch(e){setMessage(e.response?.data?.detail||'Ticket creation failed');}
  };

  const card = (label,value,sub='') => <div className="v5-card"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;

  return <div className="v5-shell">
    <style>{`.v5-shell{padding:18px;color:#eee}.v5-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.v5-card{background:#151515;border:1px solid #292929;border-radius:10px;padding:18px;min-height:95px}.v5-card span,.v5-card small{display:block;color:#999}.v5-card strong{display:block;font-size:28px;color:#ff5500;margin:8px 0}.v5-nav{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px}.v5-nav button{background:#171717;border:1px solid #333;color:#ddd;padding:10px 14px;border-radius:7px;cursor:pointer}.v5-nav button.active{border-color:#ff5500;color:#ff5500}.v5-panel{background:#111;border:1px solid #282828;border-radius:10px;padding:18px;margin-top:14px}.v5-table{width:100%;border-collapse:collapse}.v5-table th,.v5-table td{text-align:left;padding:10px;border-bottom:1px solid #242424}.v5-search{width:100%;box-sizing:border-box;background:#0b0b0b;color:#fff;border:1px solid #333;border-radius:8px;padding:12px;margin-bottom:8px}.v5-results{display:grid;gap:6px}.v5-result{padding:10px;background:#171717;border-radius:7px}.v5-actions{display:flex;gap:8px;flex-wrap:wrap}.v5-btn{background:#ff5500;color:#fff;border:0;border-radius:7px;padding:10px 14px;cursor:pointer}.v5-muted{color:#999}.v5-alert{padding:10px;background:#24150f;border:1px solid #6b2b0b;border-radius:7px;margin:10px 0}@media(max-width:900px){.v5-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.v5-grid{grid-template-columns:1fr}.v5-shell{padding:8px}.v5-card strong{font-size:24px}.v5-table{font-size:13px}}`}</style>
    <h1 style={{marginTop:0}}>APEX V5 Executive Centre</h1>
    <p className="v5-muted">Security, assets, helpdesk, stock, organisation and total cost of ownership.</p>
    <div className="v5-nav">
      {['overview','tickets','stock','security','search'].map(x=><button key={x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{x[0].toUpperCase()+x.slice(1)}</button>)}
    </div>
    {message && <div className="v5-alert">{message}</div>}
    {tab==='overview' && data && <>
      <div className="v5-grid">
        {card('Assets',data.assets)}{card('Asset Value',`£${Number(data.asset_value).toLocaleString('en-GB',{minimumFractionDigits:2})}`)}{card('Open Tickets',data.open_tickets)}{card('Low Stock',data.low_stock)}
        {card('Warranty Exposure',data.warranty_exposure)}{card('Replacement Due',data.replacement_due)}{card('V5 Costs',`£${Number(data.v5_costs).toLocaleString('en-GB',{minimumFractionDigits:2})}`)}{card('Platform','5.0.0','V5 overlay active')}
      </div>
      <div className="v5-panel"><h3>Quick actions</h3><div className="v5-actions"><button className="v5-btn" onClick={createTicket}>Create helpdesk ticket</button><button className="v5-btn" onClick={()=>setTab('security')}>Open security centre</button><button className="v5-btn" onClick={()=>setTab('stock')}>Open stockroom</button></div></div>
    </>}
    {tab==='tickets' && <div className="v5-panel"><div className="v5-actions"><button className="v5-btn" onClick={createTicket}>+ New ticket</button><button className="v5-btn" onClick={load}>Refresh</button></div><table className="v5-table"><thead><tr><th>Ticket</th><th>Title</th><th>Priority</th><th>Status</th></tr></thead><tbody>{tickets.map(t=><tr key={t.id}><td>{t.ticket_number}</td><td>{t.title}</td><td>{t.priority}</td><td>{t.status}</td></tr>)}</tbody></table></div>}
    {tab==='stock' && <div className="v5-panel"><table className="v5-table"><thead><tr><th>SKU</th><th>Item</th><th>Qty</th><th>Minimum</th><th>Location</th></tr></thead><tbody>{stock.map(s=><tr key={s.id}><td>{s.sku}</td><td>{s.name}</td><td style={{color:s.low_stock?'#ff5500':'inherit'}}>{s.quantity}</td><td>{s.minimum_quantity}</td><td>{s.location}</td></tr>)}</tbody></table></div>}
    {tab==='security' && <div className="v5-panel"><h2>Security Centre</h2><p>2FA status: <strong>{security?.totp_enabled?'Enabled':'Not enabled'}</strong></p>{!security?.totp_enabled && <button className="v5-btn" disabled={busy} onClick={start2FA}>Set up authenticator 2FA</button>}{setup && <div className="v5-panel"><p>Scan the QR with Microsoft Authenticator, Google Authenticator or another TOTP app.</p><QRCodeSVG value={setup.otpauth_uri} size={240} includeMargin={true} bgColor="#ffffff" fgColor="#000000" /><p><code>{setup.secret}</code></p><p>Recovery codes (store securely):</p><pre style={{whiteSpace:'pre-wrap'}}>{setup.recovery_codes.join('\n')}</pre><button className="v5-btn" onClick={()=>{const c=window.prompt('Enter the 6 digit authenticator code'); if(c) verify2FA(c)}}>Verify and enable</button></div>}{admin && <p className="v5-muted">Administrator security event monitoring is available through the V5 API.</p>}</div>}
    {tab==='search' && <div className="v5-panel"><input className="v5-search" value={q} onChange={e=>search(e.target.value)} placeholder="Search assets, users and tickets..."/><div className="v5-results">{results.map((r,i)=><div className="v5-result" key={i}><strong>{r.type.toUpperCase()}</strong> — {r.title}<div className="v5-muted">{r.subtitle}</div></div>)}</div></div>}
  </div>;
}
