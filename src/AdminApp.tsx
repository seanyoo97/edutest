import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, getDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { db, auth } from './firebaseConfig';
import { AssessmentResponse, handleFirestoreError, OperationType } from './types';
import { Download, Users, TrendingUp, LogOut, ShieldAlert, Settings, LayoutDashboard, KeyRound, Save, Plus, Trash2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { COURSES } from './constants';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminApp() {
  const [responses, setResponses] = useState<AssessmentResponse[]>([]);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings' | 'admins'>('dashboard');
  
  const [filterCourseId, setFilterCourseId] = useState<string>('all');
  const [filterEvalType, setFilterEvalType] = useState<string>('all');
  
  const [passwords, setPasswords] = useState<Record<number, string>>({});
  const [isSavingPass, setIsSavingPass] = useState(false);
  
  const [admins, setAdmins] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('');
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc'|'desc' } | null>(null);

  const [editAdminEmail, setEditAdminEmail] = useState<string | null>(null);
  const [editAdminName, setEditAdminName] = useState('');
  const [editAdminRole, setEditAdminRole] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    let unsubResponses: (() => void) | null = null;
    let unsubAdmins: (() => void) | null = null;

    const setupRealtimeListener = () => {
      const q = query(collection(db, 'responses'), orderBy('submittedAt', 'desc'));
      unsubResponses = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AssessmentResponse));
        setResponses(data);
      }, (error) => {
        console.error('responses listener error', error);
      });
    };

    const fetchAdmins = () => {
      const q = query(collection(db, 'admins'));
      unsubAdmins = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(d => ({ email: d.id, ...d.data() }));
        setAdmins(data);
      }, (error) => {
        console.error('admins listener error', error);
      });
    };

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (unsubResponses) { unsubResponses(); unsubResponses = null; }
      if (unsubAdmins) { unsubAdmins(); unsubAdmins = null; }

      if (user && user.email) {
        try {
          const adminRef = doc(db, 'admins', user.email);
          const adminDoc = await getDoc(adminRef);
          if (adminDoc.exists()) {
            setIsAuthorized(true);
            setupRealtimeListener();
            fetchPasswords();
            fetchAdmins();
          } else {
            if (user.email === 'seanyoo97@gmail.com') {
              await setDoc(adminRef, { createdAt: new Date().toISOString(), role: '최고 관리자', name: '시스템 관리자' });
              setIsAuthorized(true);
              setupRealtimeListener();
              fetchPasswords();
              fetchAdmins();
            } else {
              setIsAuthorized(false);
              auth.signOut();
              alert("권한이 없습니다.");
              navigate('/');
            }
          }
        } catch (error) {
          console.error("Admin check failed", error);
          setIsAuthorized(false);
        }
      } else {
        setIsAuthorized(null);
      }
      setIsLoading(false);
    });
    return () => {
      if (unsubResponses) unsubResponses();
      if (unsubAdmins) unsubAdmins();
      unsubscribeAuth();
    };
  }, [navigate]);

  const fetchPasswords = async () => {

    try {
      const snap = await getDoc(doc(db, 'settings', 'passwords'));
      if (snap.exists()) {
        setPasswords(snap.data() as Record<number, string>);
      }
    } catch(err) {
      console.error(err);
    }
  };

  const handleLogin = () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => {
      console.error(err);
      setIsLoading(false);
    });
  };

  const handleLogout = () => {
    signOut(auth);
    setResponses([]);
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail || !newAdminName || !newAdminRole) {
      alert("이메일, 이름, 직위를 모두 입력해주세요.");
      return;
    }
    setIsAddingAdmin(true);
    try {
      await setDoc(doc(db, 'admins', newAdminEmail), {
        name: newAdminName,
        role: newAdminRole,
        createdAt: new Date().toISOString()
      });
      setNewAdminEmail('');
      setNewAdminName('');
      setNewAdminRole('');
      alert("관리자가 추가되었습니다.");
    } catch (e: any) {
      console.error(e);
      alert('관리자 추가 오류: ' + e.message);
    }
    setIsAddingAdmin(false);
  };

  const handleStartEditAdmin = (admin: any) => {
    setEditAdminEmail(admin.email);
    setEditAdminName(admin.name || '');
    setEditAdminRole(admin.role || '');
  };

  const handleSaveEditAdmin = async () => {
    if (!editAdminEmail) return;
    try {
      await setDoc(doc(db, 'admins', editAdminEmail), {
        name: editAdminName,
        role: editAdminRole,
        createdAt: admins.find(a => a.email === editAdminEmail)?.createdAt || new Date().toISOString()
      });
      alert('관리자 정보가 수정되었습니다.');
      setEditAdminEmail(null);
    } catch(e) {
      console.error(e);
      alert('오류가 발생했습니다.');
    }
  };

  const [selectedResponseIds, setSelectedResponseIds] = useState<string[]>([]);

  const handleDeleteResponse = async (id: string) => {
    if (confirm("해당 응답을 삭제하시겠습니까?")) {
      try {
        await deleteDoc(doc(db, 'responses', id));
        setSelectedResponseIds(prev => prev.filter(i => i !== id));
      } catch (e) {
        console.error(e);
        alert("삭제 중 오류가 발생했습니다.");
      }
    }
  };

  const handleBatchDelete = async () => {
    if (selectedResponseIds.length === 0) return;
    if (confirm(`선택한 ${selectedResponseIds.length}개의 응답을 삭제하시겠습니까?`)) {
      try {
        await Promise.all(selectedResponseIds.map(id => deleteDoc(doc(db, 'responses', id))));
        setSelectedResponseIds([]);
      } catch (e) {
        console.error(e);
        alert("일괄 삭제 중 오류가 발생했습니다.");
      }
    }
  };

  const toggleSelectResponse = (id: string) => {
    setSelectedResponseIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedResponseIds(sortedResponses.map((r: any) => r.id));
    } else {
      setSelectedResponseIds([]);
    }
  };

  const handleDeleteAdmin = async (email: string) => {
    if (email === 'seanyoo97@gmail.com') {
      alert("최고 관리자는 삭제할 수 없습니다.");
      return;
    }
    if (confirm(`${email} 관리자를 삭제하시겠습니까?`)) {
      try {
        await deleteDoc(doc(db, 'admins', email));
        alert("삭제되었습니다.");
      } catch (e) {
        console.error(e);
        alert("삭제 중 오류가 발생했습니다.");
      }
    }
  };

  const updatePassword = (courseId: number, val: string) => {
    setPasswords(prev => ({ ...prev, [courseId]: val.replace(/[^0-9]/g, '').substring(0, 4) }));
  };

  const generateBulkPasswords = () => {
    const newPass: Record<number, string> = {};
    COURSES.forEach(c => {
      let rand = Math.floor(Math.random() * 10000).toString();
      rand = rand.padStart(4, '0');
      newPass[c.id] = rand;
    });
    setPasswords(newPass);
  };

  const savePasswords = async () => {
    setIsSavingPass(true);
    try {
      await setDoc(doc(db, 'settings', 'passwords'), passwords);
      alert('비밀번호가 성공적으로 저장되었습니다.');
    } catch(e) {
      console.error(e);
      alert('저장 중 오류가 발생했습니다.');
    }
    setIsSavingPass(false);
  };

  const filteredResponses = useMemo(() => {
    return responses.filter(r => {
      const cId = r.courseId ? r.courseId.toString() : '';
      if (filterCourseId !== 'all' && cId !== filterCourseId) return false;
      if (filterEvalType !== 'all' && r.evaluationType !== filterEvalType) return false;
      return true;
    });
  }, [responses, filterCourseId, filterEvalType]);

  const sortedResponses = useMemo(() => {
    let sortable = [...filteredResponses];
    if (sortConfig !== null) {
      sortable.sort((a: any, b: any) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        if (sortConfig.key === 'submittedAt') {
           aValue = a.submittedAt?.toDate ? a.submittedAt.toDate().getTime() : 0;
           bValue = b.submittedAt?.toDate ? b.submittedAt.toDate().getTime() : 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortable;
  }, [filteredResponses, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleExportExcel = () => {
    if (filteredResponses.length === 0) return;
    const headers = ['ID', '과정ID', '과정명', '구분', '이름', '좌석번호', '점수', '제출일시', ...filteredResponses[0].answers.map((_, i) => `Q${i+1}`)];
    const rows = sortedResponses.map(r => {
      const dateStr = r.submittedAt?.toDate ? r.submittedAt.toDate().toLocaleString() : '';
      return [r.id, r.courseId, r.courseName, r.evaluationType, r.studentName || '', r.seatNumber || '', r.score, dateStr, ...r.answers.map(a => a + 1)];
    });
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    
    // Auto size columns roughly
    const wscols = headers.map(h => ({ wch: Math.max(10, h.length + 2) }));
    wscols[2] = { wch: 30 }; // courseName wider
    wscols[7] = { wch: 25 }; // date wider
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "평가결과");
    XLSX.writeFile(wb, `assessment_results_${new Date().getTime()}.xlsx`);
  };

  const courseStats = useMemo(() => {
    const stats: Record<string, { totalScore: number, count: number, name: string }> = {};
    filteredResponses.forEach(r => {
      if (!stats[r.courseId]) {
        stats[r.courseId] = { totalScore: 0, count: 0, name: r.courseName };
      }
      stats[r.courseId].totalScore += r.score;
      stats[r.courseId].count += 1;
    });
    
    return Object.keys(stats).map(id => ({
      courseName: stats[id].name.length > 15 ? stats[id].name.substring(0, 15) + '...' : stats[id].name,
      avgScore: Math.round(stats[id].totalScore / stats[id].count),
      count: stats[id].count
    }));
  }, [filteredResponses]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">로딩 중...</div>;

  if (isAuthorized === null || isAuthorized === false) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center border-t-4 border-[#1B2A4A] relative">
          <button onClick={() => navigate('/')} className="absolute top-4 left-4 text-sm font-medium text-gray-500 hover:text-[#1B2A4A]">← 홈으로</button>
          <div className="flex justify-center mb-6 mt-4">
            <ShieldAlert className="w-16 h-16 text-[#1B2A4A]" />
          </div>
          <h2 className="text-2xl font-bold text-[#1B2A4A] mb-2">관리자 로그인</h2>
          <p className="text-gray-600 mb-8 font-medium">대시보드에 접근하려면 인가된 Google 계정으로 로그인하세요.</p>
          <button onClick={handleLogin} className="w-full bg-[#1B2A4A] hover:bg-[#2A4070] text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
            Google 로그인
          </button>
        </motion.div>
      </div>
    );
  }

  const averageScore = filteredResponses.length > 0 
    ? Math.round(filteredResponses.reduce((sum, r) => sum + r.score, 0) / filteredResponses.length) 
    : 0;

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-[#1B2A4A] text-white py-4 px-6 shadow-md flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-white/60 hover:text-white transition-colors" title="뒤로 가기">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">관리자 대시보드</h1>
        </div>
        <button onClick={handleLogout} className="text-white/80 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors">
          <LogOut className="w-4 h-4" /> 로그아웃
        </button>
      </header>

      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex gap-8">
          <button onClick={() => setActiveTab('dashboard')} className={`py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${activeTab === 'dashboard' ? 'border-[#1B2A4A] text-[#1B2A4A]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            <LayoutDashboard className="w-4 h-4" /> 응답 결과
          </button>
          <button onClick={() => setActiveTab('settings')} className={`py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${activeTab === 'settings' ? 'border-[#1B2A4A] text-[#1B2A4A]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            <Settings className="w-4 h-4" /> 과정 설정
          </button>
          <button onClick={() => setActiveTab('admins')} className={`py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${activeTab === 'admins' ? 'border-[#1B2A4A] text-[#1B2A4A]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            <ShieldCheck className="w-4 h-4" /> 관리자 설정
          </button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-6 space-y-6 pb-24">
        {activeTab === 'dashboard' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="bg-blue-50 p-4 rounded-full">
                  <Users className="w-8 h-8 text-[#1B2A4A]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">총 응답 수</p>
                  <p className="text-3xl font-black text-[#1B2A4A]">{filteredResponses.length}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="bg-orange-50 p-4 rounded-full">
                  <TrendingUp className="w-8 h-8 text-[#FF6B35]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">평균 점수</p>
                  <p className="text-3xl font-black text-[#1B2A4A]">{averageScore}<span className="text-lg font-medium text-gray-500 ml-1">점</span></p>
                </div>
              </div>
            </div>

            {courseStats.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="font-bold text-[#1B2A4A] text-lg mb-6">과정별 평균 점수 현황</h2>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={courseStats} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="courseName" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} domain={[0, 100]} />
                      <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="avgScore" name="평균 점수" fill="#FF6B35" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50/50 gap-4">
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <select value={filterCourseId} onChange={e => setFilterCourseId(e.target.value)} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-[#1B2A4A] focus:border-[#1B2A4A] block p-2.5 font-medium">
                    <option value="all">전체 과정</option>
                    {COURSES.map(c => <option key={c.id} value={c.id.toString()}>{c.name}</option>)}
                  </select>
                  <select value={filterEvalType} onChange={e => setFilterEvalType(e.target.value)} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-[#1B2A4A] focus:border-[#1B2A4A] block p-2.5 font-medium">
                    <option value="all">전체 평가</option>
                    <option value="1차">1차 평가</option>
                    <option value="2차">2차 평가</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  {selectedResponseIds.length > 0 && (
                    <button onClick={handleBatchDelete} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap">
                      <Trash2 className="w-4 h-4" /> 선택 삭제 ({selectedResponseIds.length})
                    </button>
                  )}
                  <button onClick={handleExportExcel} className="flex items-center gap-2 bg-[#1B2A4A] hover:bg-[#2A4070] text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap">
                    <Download className="w-4 h-4" /> 엑셀 파일 다운로드
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                      <th className="p-4 w-10 text-center"><input type="checkbox" onChange={toggleSelectAll} checked={sortedResponses.length > 0 && selectedResponseIds.length === sortedResponses.length} className="w-4 h-4 text-[#1B2A4A] rounded border-gray-300 focus:ring-[#1B2A4A]" /></th>
                      <th className="p-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('submittedAt')}>제출 일시 {sortConfig?.key === 'submittedAt' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                      <th className="p-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('studentName')}>이름 {sortConfig?.key === 'studentName' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                      <th className="p-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('courseName')}>평가과정 {sortConfig?.key === 'courseName' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                      <th className="p-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('evaluationType')}>구분 {sortConfig?.key === 'evaluationType' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                      <th className="p-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('score')}>점수 {sortConfig?.key === 'score' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                      <th className="p-4 font-bold">답안</th>
                      <th className="p-4 font-bold text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {sortedResponses.map((res) => (
                      <tr key={res.id} className={`hover:bg-gray-50/50 transition-colors ${selectedResponseIds.includes(res.id) ? 'bg-blue-50/30' : ''}`}>
                        <td className="p-4 text-center">
                          <input type="checkbox" checked={selectedResponseIds.includes(res.id)} onChange={() => toggleSelectResponse(res.id)} className="w-4 h-4 text-[#1B2A4A] rounded border-gray-300 focus:ring-[#1B2A4A]" />
                        </td>
                        <td className="p-4 text-gray-600 font-mono whitespace-nowrap">
                          {res.submittedAt?.toDate ? res.submittedAt.toDate().toLocaleString() : '방금 전'}
                        </td>
                        <td className="p-4 font-bold text-[#1B2A4A]">
                          {res.studentName || '-'}{res.seatNumber ? ` (좌석:${res.seatNumber})` : ''}
                        </td>
                        <td className="p-4 font-medium text-gray-800">
                          {res.courseName}
                        </td>
                        <td className="p-4">
                          <span className={`inline-block px-2 py-1 text-xs font-bold rounded-md ${res.evaluationType === '1차' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{res.evaluationType}</span>
                        </td>
                        <td className="p-4">
                          <span className="inline-block px-3 py-1 bg-orange-100 text-orange-800 font-bold rounded-full text-sm">
                            {res.score}점
                          </span>
                        </td>
                        <td className="p-4 text-gray-500 font-mono tracking-widest">
                          {res.answers.map(a => a+1).join('')}
                        </td>
                        <td className="p-4 text-center">
                          <button onClick={() => handleDeleteResponse(res.id)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded transition-colors" title="삭제">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sortedResponses.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-gray-400 font-medium">조건에 맞는 응답이 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50/50 gap-4">
              <div>
                <h2 className="font-bold text-[#1B2A4A] text-lg mb-1">과정별 참여 비밀번호 설정</h2>
                <p className="text-sm text-gray-500">교육생이 각 과정 평가에 진입하기 위해 필요한 4자리 비밀번호를 설정합니다.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={generateBulkPasswords} className="flex items-center gap-2 border border-blue-600 text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                  <KeyRound className="w-4 h-4" /> 전체 일괄 난수생성
                </button>
                <button onClick={savePasswords} disabled={isSavingPass} className="flex items-center gap-2 bg-[#FF6B35] hover:bg-[#e05421] text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm disabled:opacity-50">
                  <Save className="w-4 h-4" /> {isSavingPass ? '저장중...' : '변경사항 저장'}
                </button>
              </div>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 custom-scrollbar">
              {COURSES.map(course => (
                <div key={course.id} className="p-4 rounded-lg border border-gray-200 hover:border-gray-300 bg-gray-50/50 transition-colors">
                  <label className="block text-xs font-bold text-gray-500 mb-1">과정 {course.id}</label>
                  <h3 className="text-sm font-bold text-[#1B2A4A] mb-3 truncate" title={course.name}>{course.name}</h3>
                  <input
                    type="text"
                    maxLength={4}
                    value={passwords[course.id] || ''}
                    onChange={(e) => updatePassword(course.id, e.target.value)}
                    placeholder="숫자 4자리"
                    className="w-full text-center tracking-[0.5em] font-mono text-lg font-bold p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#1B2A4A] focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'admins' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="font-bold text-[#1B2A4A] text-lg mb-1">새 관리자 추가</h2>
                <p className="text-sm text-gray-500">대시보드에 접근할 수 있는 동료 관리자를 추가합니다.</p>
              </div>
              <div className="p-6 bg-gray-50/50 flex flex-col md:flex-row gap-4">
                <input 
                  type="text" 
                  value={newAdminName} 
                  onChange={e => setNewAdminName(e.target.value)} 
                  placeholder="관리자 이름 (예: 홍길동)" 
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B2A4A] focus:outline-none" 
                />
                <input 
                  type="text" 
                  value={newAdminRole} 
                  onChange={e => setNewAdminRole(e.target.value)} 
                  placeholder="직위/소속 (예: 교육운영팀 대리)" 
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B2A4A] focus:outline-none" 
                />
                <input 
                  type="email" 
                  value={newAdminEmail} 
                  onChange={e => setNewAdminEmail(e.target.value)} 
                  placeholder="Google 계정 이메일" 
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B2A4A] focus:outline-none" 
                />
                <button 
                  onClick={handleAddAdmin} 
                  disabled={isAddingAdmin}
                  className="bg-[#1B2A4A] hover:bg-[#2A4070] text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" /> {isAddingAdmin ? '추가 중...' : '추가하기'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="font-bold text-[#1B2A4A] text-lg">등록된 관리자 목록</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                      <th className="p-4 font-bold">이름</th>
                      <th className="p-4 font-bold">직위/소속</th>
                      <th className="p-4 font-bold">Google 이메일</th>
                      <th className="p-4 font-bold">권한</th>
                      <th className="p-4 font-bold">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {admins.map(admin => {
                      const isAuthUser = auth.currentUser?.email === admin.email;
                      const isEditing = editAdminEmail === admin.email;
                      return (
                      <tr key={admin.email} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 font-bold text-[#1B2A4A]">
                          {isEditing ? (
                            <input type="text" value={editAdminName} onChange={e => setEditAdminName(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-[#1B2A4A] outline-none" />
                          ) : (
                            admin.name || '-'
                          )}
                        </td>
                        <td className="p-4 text-gray-600">
                          {isEditing ? (
                            <input type="text" value={editAdminRole} onChange={e => setEditAdminRole(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-[#1B2A4A] outline-none" />
                          ) : (
                            admin.role || '-'
                          )}
                        </td>
                        <td className="p-4 text-gray-600 font-mono">
                          {admin.email}
                          {isAuthUser && <span className="ml-2 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">나</span>}
                        </td>
                        <td className="p-4">
                          <span className={`inline-block px-2 py-1 text-xs font-bold rounded-md ${admin.email === 'seanyoo97@gmail.com' ? 'bg-indigo-100 text-indigo-800' : 'bg-green-100 text-green-800'}`}>
                            {admin.email === 'seanyoo97@gmail.com' ? '최고 관리자' : '일반 관리자'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2 isolate">
                            {isEditing ? (
                              <>
                                <button onClick={handleSaveEditAdmin} className="text-green-600 hover:text-green-800 p-2 hover:bg-green-50 rounded transition-colors text-xs font-bold">저장</button>
                                <button onClick={() => setEditAdminEmail(null)} className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-50 rounded transition-colors text-xs font-bold">취소</button>
                              </>
                            ) : (
                              (isAuthUser || auth.currentUser?.email === 'seanyoo97@gmail.com') && (
                                <button onClick={() => handleStartEditAdmin(admin)} className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition-colors text-xs font-bold whitespace-nowrap">
                                  수정
                                </button>
                              )
                            )}
                            {admin.email !== 'seanyoo97@gmail.com' && (
                              <button onClick={() => handleDeleteAdmin(admin.email)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded transition-colors" title="삭제">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
