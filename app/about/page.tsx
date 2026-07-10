export const metadata = {
  title: "О проекте — Услышано",
};

export default function AboutPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-20 text-center">
      <p className="text-3xl font-extrabold leading-snug text-[#2A2A2E]">
        Радость, боль, всё, что не скажешь вслух — здесь тебя услышат.
      </p>
      <p className="mt-6 text-sm leading-relaxed text-[#6B6B72]">
        «Услышано» — анонимная стена настроений. Без регистрации, без имён,
        без публичных счётчиков. Пиши то, что чувствуешь, читай, что чувствуют
        другие — свои посты или случайные. Каждое сообщение живёт неделю и
        исчезает.
      </p>
    </div>
  );
}
