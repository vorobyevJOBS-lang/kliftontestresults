import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function Admin() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    const { data, error } = await supabase
      .from("results")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (!error) {
      setResults(data);
    }

    setLoading(false);
  };

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
      <h1>
        Архив кандидатов
      </h1>

      <h3>
        Всего кандидатов:
        {results.length}
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
