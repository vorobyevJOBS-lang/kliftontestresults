import React, { useMemo, useState } from "react";
import { QUESTIONS } from "./questions";
import { TALENTS } from "./talents";
import { ROLE_PROFILES } from "./roles";
import { supabase } from "./supabase";

export default function App() {
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [screen, setScreen] = useState("start");

  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);

  const totalQuestions = QUESTIONS.length;

  const currentQuestion =
    questionIndex < totalQuestions
      ? QUESTIONS[questionIndex]
      : null;

  const handleAnswer = (side) => {
    const nextAnswers = [...answers, side];

    setAnswers(nextAnswers);

    if (questionIndex + 1 < totalQuestions) {
      setQuestionIndex(questionIndex + 1);
    } else {

  saveResult();

  setScreen("result");

}
  };

  const talentScores = useMemo(() => {
    const scores = {};

    Object.keys(TALENTS).forEach((key) => {
      scores[key] = 0;
    });

    answers.forEach((answer, index) => {
      const q = QUESTIONS[index];

      if (!q) return;

      if (answer === "A") {
        scores[q.talentA] += 1;
      }

      if (answer === "B") {
        scores[q.talentB] += 1;
      }
    });

    return scores;
  }, [answers]);

  const topTalents = useMemo(() => {
    return Object.entries(talentScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [talentScores]);

  const roleMatches = useMemo(() => {
  return Object.entries(ROLE_PROFILES)
    .map(([roleId, role]) => {

      let score = 0;
      let maxScore = 0;

      Object.entries(role.weights).forEach(
        ([talentId, weight]) => {

          const talentValue =
            talentScores[talentId] || 0;

          score += talentValue * weight;

          maxScore += 25 * weight;

        }
      );

      return {
        roleId,
        roleName: role.name,
        fit: Math.min(
          100,
          Math.round(
            (score / maxScore) * 100
          )
        )
      };

    })
    .sort((a, b) => b.fit - a.fit);

}, [talentScores]);
    const saveResult = async () => {
    try {
      await supabase.from("results").insert({
        candidate_name: candidateName,
        candidate_email: candidateEmail,
        top_talents: topTalents,
        role_matches: roleMatches,
        report_json: talentScores,
        fit: roleMatches?.[0]?.fit || 0,
        position_name:
          roleMatches?.[0]?.roleName || null
      });
    } catch (error) {
      console.error(error);
    }
  };

  if (screen === "start") {
    return (
      <div
        style={{
          maxWidth: 900,
          margin: "40px auto",
          padding: 20
        }}
      >
        <h1>
          Тест сильных сторон Jobs /
          Клячка
        </h1>

        <p>
          Ответьте на все вопросы.
          Выбирайте вариант, который
          больше похож на вас.
        </p>

        <input
          placeholder="ФИО"
          value={candidateName}
          onChange={(e) =>
            setCandidateName(e.target.value)
          }
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 12
          }}
        />

        <input
          placeholder="Email (необязательно)"
          value={candidateEmail}
          onChange={(e) =>
            setCandidateEmail(e.target.value)
          }
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 20
          }}
        />

        <button
          onClick={() => {
            if (!candidateName.trim()) {
              alert("Введите ФИО");
              return;
            }

            setScreen("test");
          }}
        >
          Начать тест
        </button>
      </div>
    );
  }

  if (screen === "test") {
    const progress = Math.round(
      ((questionIndex + 1) /
        totalQuestions) *
        100
    );

    return (
      <div
        style={{
          maxWidth: 900,
          margin: "40px auto",
          padding: 20
        }}
      >
        <h2>
          Вопрос {questionIndex + 1} из{" "}
          {totalQuestions}
        </h2>

        <div
          style={{
            width: "100%",
            height: 12,
            background: "#eee",
            marginBottom: 20
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "#4caf50"
            }}
          />
        </div>

        <button
          onClick={() =>
            handleAnswer("A")
          }
          style={{
            width: "100%",
            padding: 20,
            marginBottom: 20
          }}
        >
          {currentQuestion.a}
        </button>

        <button
          onClick={() =>
            handleAnswer("B")
          }
          style={{
            width: "100%",
            padding: 20
          }}
        >
          {currentQuestion.b}
        </button>
      </div>
    );
  }
    if (screen === "result") {

  return (
    <div
      style={{
        maxWidth: 700,
        margin: "40px auto",
        padding: 20,
        textAlign: "center"
      }}
    >
      <h1>
        Спасибо за прохождение теста
      </h1>

      <p>
        Результат успешно сохранён.
      </p>

      <p>
        Мы свяжемся с вами после анализа.
      </p>
    </div>
  );
}

return null;
}
