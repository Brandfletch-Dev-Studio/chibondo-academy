import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Star, Save, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function QuizAttemptView({ quiz, onComplete }) {
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(quiz.time_limit_minutes * 60 || null);
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => db.auth.me() });

  // Timer
  React.useEffect(() => {
    if (!timeRemaining || timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeRemaining]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const submitMutation = useMutation({
    mutationFn: async (attemptData) => {
      return db.entities.QuizAttempt.create(attemptData);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quizAttempts'] });
      toast.success('Quiz submitted!');
      onComplete?.(data);
    },
  });

  const handleSubmit = (timedOut = false) => {
    const questions = quiz.questions || [];
    const answeredQuestions = questions.map(q => {
      const userAnswer = answers[q.id];
      let isCorrect = false;
      
      if (q.type === 'multiple_choice' || q.type === 'true_false') {
        isCorrect = userAnswer === q.correct_answer;
      } else if (q.type === 'multiple_select') {
        const correct = q.correct_answers || [];
        isCorrect = userAnswer && userAnswer.length === correct.length && 
          userAnswer.every(a => correct.includes(a));
      }
      
      return {
        question_id: q.id,
        answer: userAnswer || '',
        is_correct: isCorrect,
      };
    });

    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    const earnedPoints = answeredQuestions.filter(a => a.is_correct).reduce((sum, a, idx) => {
      return sum + (a.is_correct ? (questions[idx].points || 1) : 0);
    }, 0);
    
    const percentage = Math.round((earnedPoints / totalPoints) * 100);
    const passed = percentage >= (quiz.pass_percentage || 50);

    submitMutation.mutate({
      quiz_id: quiz.id,
      student_id: user.id,
      student_name: user.full_name,
      answers: answeredQuestions,
      score: earnedPoints,
      total_points: totalPoints,
      percentage,
      passed,
      time_taken_seconds: (quiz.time_limit_minutes * 60 || 0) - (timeRemaining || 0),
      status: timedOut ? 'timed_out' : 'completed',
    });
  };

  const answeredCount = Object.keys(answers).length;
  const totalCount = quiz.questions?.length || 0;
  const progress = Math.round((answeredCount / totalCount) * 100);

  return (
    <div className="space-y-6">
      {/* Timer and Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="text-2xl font-mono font-bold">
                {timeRemaining !== null ? formatTime(timeRemaining) : 'No limit'}
              </div>
              <Badge variant={timeRemaining < 60 ? 'destructive' : 'default'}>
                {answeredCount}/{totalCount} Answered
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {progress}% Complete
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <div className="space-y-6">
        {quiz.questions?.map((question, idx) => (
          <Card key={question.id}>
            <CardHeader>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-1">Q{idx + 1}</Badge>
                <div className="flex-1">
                  <CardTitle className="text-lg">{question.question}</CardTitle>
                  {question.explanation && (
                    <p className="text-sm text-muted-foreground mt-2">{question.explanation}</p>
                  )}
                </div>
                <div className="text-sm font-medium text-primary">
                  {question.points || 1} pts
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {question.type === 'multiple_choice' && (
                <div className="space-y-2">
                  {question.options?.map((option, optIdx) => (
                    <button
                      key={optIdx}
                      onClick={() => handleAnswer(question.id, option)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        answers[question.id] === option
                          ? 'border-primary bg-primary/10'
                          : 'border-input hover:bg-muted'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {question.type === 'true_false' && (
                <div className="grid gap-2 md:grid-cols-2">
                  {['True', 'False'].map((option) => (
                    <button
                      key={option}
                      onClick={() => handleAnswer(question.id, option)}
                      className={`p-3 rounded-lg border transition-all ${
                        answers[question.id] === option
                          ? 'border-primary bg-primary/10'
                          : 'border-input hover:bg-muted'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {question.type === 'fill_blank' && (
                <Input
                  placeholder="Type your answer..."
                  value={answers[question.id] || ''}
                  onChange={(e) => handleAnswer(question.id, e.target.value)}
                  className="mt-2"
                />
              )}

              {question.type === 'short_answer' && (
                <Textarea
                  placeholder="Type your answer..."
                  value={answers[question.id] || ''}
                  onChange={(e) => handleAnswer(question.id, e.target.value)}
                  className="mt-2 min-h-[100px]"
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={() => handleSubmit(false)} className="w-full" size="lg">
        <CheckCircle className="w-5 h-5 mr-2" />
        Submit Quiz
      </Button>
    </div>
  );
}