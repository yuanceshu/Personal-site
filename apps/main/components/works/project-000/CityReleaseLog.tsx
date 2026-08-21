import Image from "next/image";
import { cities } from "@/content/projects/project-000";

export function CityReleaseLog() {
  return (
    <ol className="release-log release-log--editorial">
      {cities.map((item, index) => (
        <li className="release-card" key={item.city}>
          <figure className="release-card__media">
            <Image
              src={item.image}
              alt={item.alt}
              fill
              sizes="(max-width: 720px) 100vw, (max-width: 1100px) 44vw, 38vw"
            />
            <figcaption>0{index + 1}</figcaption>
          </figure>
          <div className="release-card__body">
            <div className="release-card__title">
              <div>
                <strong>{item.city}</strong>
                <span>{item.release}</span>
              </div>
              <p>{item.date} · {item.people}</p>
            </div>
            <p className="release-card__observation">{item.observation}</p>
            <div className="release-card__change">
              <span>下一场带走的修改</span>
              <p>{item.change}</p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
