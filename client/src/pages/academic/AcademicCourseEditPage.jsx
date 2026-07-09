import { useParams } from 'react-router-dom';
import AcademicSetupPage from './AcademicSetupPage';

export default function AcademicCourseEditPage() {
  const { courseId } = useParams();
  return (
    <AcademicSetupPage
      screen="course-edit"
      initialFields={{ update: [courseId] }}
    />
  );
}
