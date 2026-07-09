/**
 * Parse legacy student_mattendance.php HTML into editable entries.
 */
export function parseStudentDailyAttendanceHtml(html) {
  if (!html) return { entries: [], studentLists: {} };

  const entries = [];
  const studentLists = {};

  const blockRegex = /<td[^>]*bgcolor="[^"]*"[^>]*>([\s\S]*?)<\/td>/gi;
  let block;
  while ((block = blockRegex.exec(html)) !== null) {
    const chunk = block[1];
    if (!chunk.includes('present_list[]')) continue;

    const presentMatch = chunk.match(/<textarea[^>]*name="present_list\[\]"[^>]*>([\s\S]*?)<\/textarea>/i);
    const courseMatch = chunk.match(/name="att_course_id\[\]"[^>]*value="([^"]*)"/i);
    const yearMatch = chunk.match(/name="att_a_year\[\]"[^>]*value="([^"]*)"/i);
    const typeMatch = chunk.match(/name="att_a_type\[\]"[^>]*value="([^"]*)"/i);
    const cYearMatch = chunk.match(/name="att_c_year\[\]"[^>]*value="([^"]*)"/i);
    const periodMatch = chunk.match(/name="att_period\[\]"[^>]*value="([^"]*)"/i);

    if (!courseMatch || !periodMatch) continue;

    const courseId = courseMatch[1];
    const currentYear = cYearMatch?.[1] || '';
    const key = `${courseId}_${currentYear}`;

    if (!studentLists[key]) {
      const listMatch = html.match(
        new RegExp(`name="att_slist_${courseId}_${currentYear}"[^>]*value="([^"]*)"`, 'i'),
      );
      if (listMatch) {
        studentLists[key] = listMatch[1];
      }
    }

    entries.push({
      courseId,
      academicYear: yearMatch?.[1] || '',
      academicType: typeMatch?.[1] || '',
      currentYear,
      period: periodMatch[1],
      periodLabel: periodMatch[1],
      presentList: presentMatch ? presentMatch[1].trim() : '',
      studentList: studentLists[key] || '',
    });
  }

  return { entries, studentLists };
}
