import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function Admin() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  const [authorized, setAuthorized] =
    useState(false);

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const { data } = await supabase
      .from("admins")
      .select("*")
      .eq("login", login)
      .eq("password", password)
      .single();

    if (data) {
      setAuthorized(true);
      loadResults();
    } else {
      alert("Неверный логин или пароль");
    }
  };

  const loadResults = async () => {
    setLoading(true);

    const { data } = await supabase
      .from("results")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (data) {
      setResults(data);
    }

    setLoading(false);
  };

  if (!authorized) {
    return (
      <div
        style={{
          maxWidth: 400,
          margin: "100px auto",
          padding: 30
        }}
      >
        <h1>Вход в админку</h1>

        <input
          placeholder="Логин"
          value={login}
          onChange={(e) =>
            setLogin(e.target.value)
          }
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 12
          }}
        />

        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 20
          }}
        />

        <button
          onClick={handleLogin}
          style={{
            width: "100%",
            padding: 12
          }}
        >
          Войти
        </button>
      </div>
    );
  }

  if (loading) {
    return <h2>Загрузка...</h2>;
  }

  return (
    <div
      style={{
        padding: 30,
        maxWidth: 1400,
        margin: "0 auto"
      }}
    >
      <h1>Архив кандидатов</h1>

      <h3>
        Всего кандидатов: {results.length}
      </h3>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse"
        }}
      >
        <thead>
          <tr>
            <th>Дата</th>
            <th>Имя</th>
            <th>Email</th>
            <th>Должность</th>
            <th>Соответствие</th>
          </tr>
        </thead>

        <tbody>
          {results.map((item) => (
            <tr key={item.id}>
              <td>
                {new Date(
                  item.created_at
                ).toLocaleString()}
              </td>

              <td>
                {item.candidate_name}
              </td>

              <td>
                {item.candidate_email}
              </td>

              <td>
                {item.position_name}
              </td>

              <td>
                {item.fit}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
