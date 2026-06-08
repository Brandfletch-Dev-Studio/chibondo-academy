import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Clock, CheckCircle2, XCircle, Trophy } from 'lucide-react';
import { toast } from 'sonner';

export default function QuizPage() {
  const { quizId } = useParams();
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  // FIX 6a: keep answers in a ref so the timer closure always reads the latest values
  // (setInterval captures a stale closure over `answers` state — ref avoids this)
  const answersRef = useRef({});
  const timerRef = useRef(null);
  const submittedRef = useRef(false);

  const updateAnswer = (questionId, value) => {
    const updated = { ...answersRef.current, [questionId]: value };
    answersRef.current = updated;
    setAnswers(updated);
  };

  const { data: quiz } = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: async () => { const r = await base44.entities.Quiz.filter({ id: quizId }); return r[0]; },
  });

  const submitMutation = useMutation({
    mutationFn: (attemptData) => base44.entities.QuizAttempt.create(attemptData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myQuizAttempts'] });
    },
  });

  // FIX 6b: handleSubmit reads from answersRef (always fresh) not from stale state closure
  const handleSubmit = useCallback((fromTimer = false) => {
    if (submittedRef.current) return; // prevent double-submit
    if (!quiz?.questions?.length) {
      // FIX 9: guard against empty quiz
      toast.error('This quiz has no questions yet.');
      return;
    }

    submittedRef.current = true;

    // Clear timer if still running
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const currentAnswers = answersRef.current;
    let score = 0;
    let totalPoints = 0;
    const gradedAnswers = quiz.questions.map(q => {
      const userAnswer = currentAnswers[q.id] || '';
      const isCorrect = userAnswer.toLowerCase().trim() === (q.correct_answer || '').toLowerCase().trim();
      if (isCorrect) score += (q.points || 1);
      totalPoints += (q.points || 1);
      return { question_id: q.id, answer: userAnswer, is_correct: isCorrect };
    });

    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
    const passed = percentage >= (quiz.pass_percentage || 50);

    if (fromTimer) toast.info("⏰ Time's up! Submitting your answers...");

    const attemptData = {
      quiz_id: quizId,
      student_id: user.id,
      student_name: user.full_name,
      answers: gradedAnswers,
      score,
      total_points: totalPoints,
      percentage,
      passed,
      status: 'completed',
    };

    submitMutation.mutate(attemptData);
    setResult({ score, totalPoints, percentage, passed, gradedAnswers });
    setSubmitted(true);
  }, [quiz, quizId, user, submitMutation]);

  // FIX 6c: timer effect — depends on handleSubmit (stable via useCallback) not stale inline fn
  useEffect(() => {
    if (!quiz?.time_limit_minutes || quiz.time_limit_minutes <= 0 || submitted) return;

    submittedRef.current = false;
    const totalSeconds = quiz.time_limit_minutes * 60;
    setTimeLeft(totalSeconds);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          handleSubmit(true); // pass fromTimer=true
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [quiz?.id]); // only re-run when quiz ID changes (not on every handleSubmit re-creation)

  if (!quiz) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  const questions = quiz.questions || [];

  // FIX 9: empty quiz guard — show friendly message instead of blank/crashing
  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <XCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-display font-bold">No Questions Yet</h2>
        <p className="text-sm text-muted-foreground max-w-xs">This quiz doesn't have any questions added yet. Check back later.</p>
        <Link to="/my-quizzes"><Button variant="outline">Back to Quizzes</Button></Link>
      </div>
    );
  }

  if (submitted && result) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Card className="text-center">
          <CardContent className="p-8">
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${result.passed ? 'bg-success/10' : 'bg-destructive/10'}`}>
              {result.passed ? <Trophy className="w-10 h-10 text-success" /> : <XCircle className="w-10 h-10 text-destructive" />}
            </div>
            <h2 className="text-2xl font-display font-bold">{result.passed ? 'Congratulations!' : 'Keep Trying!'}</h2>
            <p className="text-muted-foreground mt-2">{result.passed ? 'You passed the quiz!' : 'You can retake this quiz.'}</p>
            <div className="text-5xl font-bold font-display mt-4 text-primary">{result.percentage}%</div>
            <p className="text-sm text-muted-foreground mt-1">{result.score}/{result.totalPoints} points</p>
          </CardContent>
        </Card>

        {/* Review answers */}
        <div className="space-y-3">
          {questions.map((q, idx) => {
            const graded = result.gradedAnswers[idx];
            return (
              <Card key={q.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    {graded?.is_correct ? <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" /> : <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />}
                    <div>
                      <p className="text-sm font-medium">{q.question}</p>
                      <p className="text-xs text-muted-foreground mt-1">Your answer: {graded?.answer || 'No answer'}</p>
                      {!graded?.is_correct && <p className="text-xs text-success mt-1">Correct: {q.correct_answer}</p>}
                      {q.explanation && <p className="text-xs text-muted-foreground mt-1 italic">{q.explanation}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-center">
          <Link to="/my-quizzes"><Button variant="outline">Back to Quizzes</Button></Link>
        </div>
      </div>
    );
  }

  const question = questions[currentQ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-display font-bold">{quiz.title}</h1>
          <p className="text-xs text-muted-foreground">Question {currentQ + 1} of {questions.length}</p>
        </div>
        {timeLeft !== null && (
          <div className={`flex items-center gap-1 text-sm font-mono px-3 py-1.5 rounded-lg transition-colors ${
            timeLeft <= 60 ? 'bg-destructive/10 text-destructive' : 'bg-muted'
          }`}>
            <Clock className="w-4 h-4" />
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
        )}
      </div>
      <Progress value={((currentQ + 1) / questions.length) * 100} className="h-1.5" />

      {/* Question */}
      <Card>
        <CardContent className="p-6">
          <p className="font-medium mb-4">{question.question}</p>
          {(question.type === 'multiple_choice' || question.type === 'true_false') && (
            <RadioGroup
              value={answers[question.id] || ''}
              onValueChange={v => updateAnswer(question.id, v)}
            >
              {(question.options || []).map((opt, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value={opt} id={`q-${question.id}-${i}`} />
                  <Label htmlFor={`q-${question.id}-${i}`} className="cursor-pointer flex-1 text-sm">{opt}</Label>
                </div>
              ))}
            </RadioGroup>
          )}
          {(question.type === 'fill_blank' || question.type === 'short_answer') && (
            <input
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm bg-background"
              value={answers[question.id] || ''}
              onChange={e => updateAnswer(question.id, e.target.value)}
              placeholder="Type your answer..."
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={currentQ === 0} onClick={() => setCurrentQ(currentQ - 1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Previous
        </Button>
        {currentQ < questions.length - 1 ? (
          <Button onClick={() => setCurrentQ(currentQ + 1)}>
            Next <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={() => handleSubmit(false)} className="bg-success hover:bg-success/90 text-success-foreground">
            <CheckCircle2 className="w-4 h-4 mr-1" /> Submit Quiz
          </Button>
        )}
      </div>
    </div>
  );
}
