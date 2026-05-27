import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db, auth } from './firebaseConfig';
import { COURSES } from './constants';
import { CheckCircle, AlertCircle, BookOpen, Lock, ChevronRight, Settings, Zap } from 'lucide-react';
import logoBottom from './KEEA CI_2. 마크+국문_가로형1.png';
import { handleFirestoreError, OperationType } from './types';
import { motion } from 'motion/react';

type Step = 'select_course' | 'select_eval_type' | 'password' | 'test' | 'result';
type EvalType = '1차' | '2차';

export default function TraineeApp() {
  const [step, setStep] = useState<Step>('select_course');
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [evalType, setEvalType] = useState<EvalType | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [studentName, setStudentName] = useState('');
  const [seatNumber, setSeatNumber] = useState('');
  
  const [answers, setAnswers] = useState<number[]>(new Array(10).fill(-1));
  const [score, setScore] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedScores, setCompletedScores] = useState<Record<string, any>>({});

  useEffect(() => {
    const scores = JSON.parse(localStorage.getItem('trainee_completed_evals') || '{}');
    setCompletedScores(scores);
  }, []);

  const handleStartTest = async () => {
    setPasswordError('');
    if (!selectedCourseId || !evalType) return;
    
    if (!studentName.trim() || !seatNumber.trim()) {
      setPasswordError('이름과 좌석 번호를 모두 입력해주세요.');
      return;
    }
    
    // Check duplication locally first
    const evalKey = `${selectedCourseId}_${evalType}`;
    const previousEval = completedScores[evalKey];
    if (previousEval !== undefined) {
      const isObject = typeof previousEval === 'object' && previousEval !== null;
      const displayScore = isObject ? previousEval.score : previousEval;
      const submittedAt = isObject ? previousEval.submittedAt : 0;
      
      const fiveDaysInMs = 5 * 24 * 60 * 60 * 1000;
      if (Date.now() - submittedAt < fiveDaysInMs) {
        setScore(displayScore);
        setStep('result');
        return;
      }
    }

    try {
      const passDoc = await getDoc(doc(db, 'settings', 'passwords'));
      if (!passDoc.exists()) {
        setPasswordError('비밀번호가 아직 설정되지 않았습니다. 관리자에게 문의하세요.');
        return;
      }
      const data = passDoc.data();
      const actualPassword = data[selectedCourseId];
      
      if (!actualPassword) {
        setPasswordError('해당 과정의 비밀번호가 설정되지 않았습니다.');
        return;
      }

      if (passwordInput === actualPassword) {
        const course = COURSES.find(c => c.id === selectedCourseId);
        setAnswers(new Array(course?.questions.length || 10).fill(-1));
        setStep('test');
      } else {
        setPasswordError('비밀번호가 일치하지 않습니다.');
      }
    } catch (err) {
      console.error(err);
      setPasswordError('비밀번호 확인 중 오류가 발생했습니다.');
    }
  };

  const handleSelectAnswer = (questionIndex: number, optionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const allAnswered = answers.every(a => a !== -1);

  const handleSubmit = async () => {
    if (!allAnswered || isSubmitting || !selectedCourseId || !evalType) return;
    setIsSubmitting(true);

    const course = COURSES.find(c => c.id === selectedCourseId);
    if (!course) return;

    let calculatedScore = 0;
    answers.forEach((ans, idx) => {
      if (ans === course.questions[idx].correctAnswerIndex) {
        calculatedScore += 10;
      }
    });

    try {
      await addDoc(collection(db, 'responses'), {
        courseId: parseInt(selectedCourseId.toString(), 10),
        courseName: course.name,
        evaluationType: evalType,
        studentName: studentName.trim(),
        seatNumber: seatNumber.trim(),
        score: calculatedScore,
        answers: answers,
        submittedAt: serverTimestamp(),
        metaVersion: "v1.2"
      });
      
      const evalKey = `${selectedCourseId}_${evalType}`;
      const newScores = { 
        ...completedScores, 
        [evalKey]: {
          score: calculatedScore,
          submittedAt: Date.now()
        } 
      };
      localStorage.setItem('trainee_completed_evals', JSON.stringify(newScores));
      setCompletedScores(newScores);
      setScore(calculatedScore);
      setStep('result');
    } catch (error) {
      handleFirestoreError(auth, error, OperationType.CREATE, 'responses');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSelectCourse = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto p-4 mt-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-[#1B2A4A] mb-4">1. 평가 대상 교육과정 선택</h2>
        <p className="text-sm text-gray-500 mb-4">수강을 하고 계신 교육과정을 선택해주세요.</p>
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {COURSES.map((course) => (
            <button
              key={course.id}
              onClick={() => {
                setSelectedCourseId(course.id);
                setEvalType(null); // Reset eval type
                setPasswordInput('');
                setStep('select_eval_type');
              }}
              className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-[#FF6B35] hover:bg-orange-50 transition-colors flex justify-between items-center group bg-white"
            >
              <div>
                <span className="text-xs font-bold text-[#FF6B35] block mb-1">과정 {course.id}</span>
                <span className="font-bold text-[#1B2A4A] group-hover:text-[#FF6B35] transition-colors">{course.name}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#FF6B35]" />
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );

  const renderSelectEvalType = () => {
    const course = COURSES.find(c => c.id === selectedCourseId);
    if (!course) return null;

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto p-4 mt-6">
        <button onClick={() => setStep('select_course')} className="mb-4 text-sm font-medium text-gray-500 hover:text-[#1B2A4A]">← 다른 과정 선택하기</button>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-xl font-bold text-[#1B2A4A] mb-2">2. 평가 구분 선택</h2>
          <p className="text-sm text-gray-600 font-medium mb-6">선택한 과정: {course.name}</p>
          <div className="flex gap-4">
            {(['1차', '2차'] as EvalType[]).map((type) => {
              const evalKey = `${course.id}_${type}`;
              const hasCompletedData = completedScores[evalKey];
              let hasCompleted = false;
              let displayScore = 0;
              
              if (hasCompletedData !== undefined) {
                const isObject = typeof hasCompletedData === 'object' && hasCompletedData !== null;
                displayScore = isObject ? hasCompletedData.score : hasCompletedData;
                const submittedAt = isObject ? hasCompletedData.submittedAt : 0;
                
                const fiveDaysInMs = 5 * 24 * 60 * 60 * 1000;
                if (Date.now() - submittedAt < fiveDaysInMs) {
                  hasCompleted = true;
                }
              }

              return (
                <button
                  key={type}
                  onClick={() => {
                    setEvalType(type);
                    if (hasCompleted) {
                      setScore(displayScore);
                      setStep('result');
                    } else {
                      setPasswordInput('');
                      setStep('password');
                    }
                  }}
                  className={`relative flex-1 py-6 rounded-lg font-bold transition-all border-2 text-lg flex flex-col items-center justify-center gap-2 ${
                    hasCompleted 
                      ? 'bg-gray-50 border-gray-200 text-gray-500' 
                      : 'bg-white border-[#1B2A4A] text-[#1B2A4A] hover:bg-[#1B2A4A] hover:text-white group'
                  }`}
                >
                  <span>{type} 평가</span>
                  {hasCompleted && (
                    <span className="text-xs font-bold text-gray-400 bg-gray-200 px-2 py-1 rounded">참여완료 ({displayScore}점)</span>
                  )}
                  {!hasCompleted && (
                    <span className="text-xs font-bold text-[#FF6B35] group-hover:text-white transition-colors">응시하기</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderPassword = () => (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 relative overflow-hidden">
        <button onClick={() => setStep('select_eval_type')} className="absolute top-4 left-4 text-sm font-medium text-gray-500 hover:text-[#1B2A4A]">← 이전</button>
        <div className="flex justify-center mb-6 mt-4">
           <BookOpen className="w-12 h-12 text-[#1B2A4A]" />
        </div>
        <h2 className="text-xl font-bold text-center text-[#1B2A4A] mb-2 break-keep">수강생 정보 및 비밀번호 입력</h2>
        <p className="text-center text-sm text-gray-600 mb-6 font-medium break-keep break-words">[{evalType}] {COURSES.find(c=>c.id === selectedCourseId)?.name}</p>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">이름</label>
            <input 
              type="text" 
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="홍길동"
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-[#1B2A4A] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">좌석 번호</label>
            <input 
              type="text" 
              value={seatNumber}
              onChange={(e) => setSeatNumber(e.target.value)}
              placeholder="12"
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-[#1B2A4A] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#FF6B35] mb-1">평가 비밀번호 (4자리)</label>
            <input 
              type="password" 
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="****"
              className="w-full p-3 text-center text-xl tracking-widest font-bold bg-white border border-[#FF6B35] rounded-lg focus:ring-2 focus:ring-[#FF6B35] focus:outline-none"
            />
          </div>
        </div>

        {passwordError && <p className="text-red-500 text-sm text-center mb-4 font-medium break-keep">{passwordError}</p>}
        
        <button onClick={handleStartTest} className="w-full bg-[#1B2A4A] hover:bg-[#2A4070] text-white font-bold py-4 rounded-lg shadow-md transition-colors">
          시험 시작하기
        </button>
      </motion.div>
    </div>
  );

  const renderTest = () => {
    const course = COURSES.find(c => c.id === selectedCourseId);
    if (!course) return null;

    return (
      <div className="pb-24">
        <div className="max-w-3xl mx-auto p-4 mt-6">
          <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-3 shadow-sm min-w-0">
            <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-800 break-keep">
              <p className="font-bold mb-1 text-[#1B2A4A] break-words">[{evalType}] {course.name}</p>
              <p>모든 {course.questions.length}문항에 답하셔야 제출이 가능합니다. 화이팅!</p>
            </div>
          </div>

          <div className="space-y-8">
            {course.questions.map((q, qIndex) => (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: qIndex * 0.05 }} key={q.id} className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-gray-100 min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-[#1B2A4A] mb-4 flex gap-2 break-keep">
                  <span className="text-[#FF6B35] flex-shrink-0">Q{qIndex + 1}.</span> 
                  <span className="break-words font-medium">{q.text}</span>
                </h3>
                {q.boxContent && (
                  <div className="mb-5 p-4 rounded bg-gray-50 border border-gray-200">
                    <ul className="space-y-1.5 text-sm sm:text-base text-gray-700 font-medium">
                      {q.boxContent.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {q.image && (
                  <div className="mb-4 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex justify-center p-2">
                    <img src={q.image} alt={`Question ${qIndex + 1} reference`} className="max-w-full max-h-64 object-contain" />
                  </div>
                )}
                <div className="space-y-2 sm:space-y-3">
                  {q.options.map((option, oIndex) => {
                    const isSelected = answers[qIndex] === oIndex;
                    return (
                      <label onClick={() => handleSelectAnswer(qIndex, oIndex)} key={oIndex} className={`block w-full text-left p-3 sm:p-4 rounded-lg border transition-all cursor-pointer ${isSelected ? 'border-[#FF6B35] bg-orange-50 ring-1 ring-[#FF6B35]' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-[#FF6B35]' : 'border-gray-300'}`}>
                            {isSelected && <div className="w-3 h-3 rounded-full bg-[#FF6B35]" />}
                          </div>
                          <span className={`font-medium text-sm sm:text-base break-keep ${isSelected ? 'text-[#1B2A4A]' : 'text-gray-700'}`}>{option}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500">
              <span className="text-[#1B2A4A] text-lg font-bold">{answers.filter(a => a !== -1).length}</span> / {course.questions.length} 완료
            </div>
            <button onClick={handleSubmit} disabled={!allAnswered || isSubmitting} className={`px-8 py-3 rounded-lg font-bold text-white transition-all ${(!allAnswered || isSubmitting) ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#1B2A4A] hover:bg-[#2A4070] shadow-md hover:shadow-lg'}`}>
              {isSubmitting ? '제출 중...' : '제출하기'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderResult = () => {
    let feedback = "";
    if (score !== null && score >= 90) feedback = "탁월한 이해도를 보이셨습니다. 수고하셨습니다!";
    else if (score !== null && score >= 70) feedback = "안정적인 안전 지식을 갖추셨습니다.";
    else feedback = "주요 안전 수칙을 다시 한번 복습해 보시길 권장합니다.";

    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl shadow-lg max-w-lg w-full p-8 text-center border-t-4 border-[#FF6B35]">
          <div className="flex justify-center mb-6">
            <CheckCircle className="w-16 h-16 text-[#FF6B35]" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1B2A4A] mb-2 break-keep">평가가 완료되었습니다</h2>
          <p className="text-gray-600 mb-8 font-medium text-sm sm:text-base break-keep">[{evalType}] {COURSES.find(c=>c.id === selectedCourseId)?.name}</p>
          
          <div className="bg-[#f1f4f8] rounded-full w-48 h-48 mx-auto flex items-center justify-center mb-6 shadow-inner">
            <div className="text-center">
              <span className="text-5xl font-black text-[#1B2A4A]">{score}</span>
              <span className="text-xl text-gray-500 font-bold ml-1">점</span>
            </div>
          </div>
          <p className="text-lg font-medium text-[#1B2A4A] bg-[#FF6B35]/10 py-3 px-4 rounded-lg inline-block mb-8">{feedback}</p>
          
          <div>
            <button onClick={() => { setStep('select_course'); setEvalType(null); setSelectedCourseId(null); setStudentName(''); setSeatNumber(''); }} className="text-sm font-bold text-gray-500 hover:text-[#1B2A4A] underline underline-offset-4">다른 과정/평가 응시하기</button>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <header className="bg-[#1B2A4A] text-white py-5 px-4 shadow-md sticky top-0 z-30 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex justify-between items-center break-keep">
          <div className="min-w-0 pr-2 flex items-center gap-3">
            <div className="p-1 bg-white rounded flex items-center justify-center h-9 w-9">
              <img src="/logo-top.png" alt="한국전기기술인협회 심볼" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">한국전기기술인협회 국가인적자원개발컨소시엄 교육 평가지</h1>
          </div>
          <Link to="/admin" className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white flex-shrink-0" title="관리자페이지">
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </header>
      <main className="flex-1">
        {step === 'select_course' && renderSelectCourse()}
        {step === 'select_eval_type' && renderSelectEvalType()}
        {step === 'password' && renderPassword()}
        {step === 'test' && renderTest()}
        {step === 'result' && renderResult()}
      </main>
      
      {/* 하단 푸터 (협회 로고 삽입 위치) */}
      <footer className="w-full bg-white border-t border-gray-200 py-6 mt-12 flex-shrink-0">
        <div className="max-w-3xl mx-auto px-4 flex flex-col justify-center items-center gap-3">
           <img src={logoBottom} alt="한국전기기술인협회" className="h-10 object-contain" />
           <p className="text-xs text-gray-400">&copy; 2026 한국전기기술인협회. All Rights Reserved. (교육 평가지)</p>
        </div>
      </footer>
    </div>
  );
}

