import { courseTimeline } from "@/content/projects/project-000";

export function CourseTimeline() {
  return (
    <div className="course-timeline" aria-label="210 分钟课程结构">
      <div className="course-timeline__bar" aria-hidden="true">
        {courseTimeline.map((item) => (
          <span
            className={`course-timeline__segment course-timeline__segment--${item.kind}`}
            key={item.label}
            style={{ flexGrow: item.minutes }}
          />
        ))}
      </div>
      <ol>
        {courseTimeline.map((item, index) => (
          <li key={item.label}>
            <span className="course-timeline__index">0{index + 1}</span>
            <div>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
            </div>
            <b>{item.minutes}′</b>
          </li>
        ))}
      </ol>
    </div>
  );
}
