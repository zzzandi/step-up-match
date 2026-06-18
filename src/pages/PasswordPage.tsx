import {
  FormEvent,
  useState,
} from "react";
import {
  useNavigate,
} from "react-router-dom";

interface PasswordPageProps {
  title: string;
  description: string;
  password: string;
  successPath: string;
}

export default function PasswordPage({
  title,
  description,
  password,
  successPath,
}: PasswordPageProps) {
  const navigate = useNavigate();
  const [value, setValue] =
    useState("");
  const [error, setError] =
    useState("");

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (value === password) {
      navigate(successPath);
      return;
    }

    setError(
      "Invalid password."
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-xl mx-auto py-12">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="
            mb-8
            rounded-xl
            bg-slate-800
            px-4
            py-2
            text-slate-200
            hover:bg-slate-700
          "
        >
          Back
        </button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold">
            {title}
          </h1>

          <p className="text-slate-400 mt-2">
            {description}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl bg-slate-900 p-6 border border-slate-800"
        >
          <label
            htmlFor="password"
            className="block mb-2 text-slate-400"
          >
            Password
          </label>

          <input
            id="password"
            type="password"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
            }}
            className="
              w-full
              rounded-xl
              border
              border-slate-700
              bg-slate-800
              p-3
              text-white
              outline-none
              focus:border-cyan-400
            "
            autoFocus
          />

          {error && (
            <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="
              mt-6
              w-full
              rounded-xl
              bg-lime-400
              py-3
              font-bold
              text-black
              hover:bg-lime-300
            "
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
