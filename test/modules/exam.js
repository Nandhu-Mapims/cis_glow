import { assert, assertOk } from '../lib/assert.js';
import { EXAM_SETUP, setupLoadTests } from '../lib/screens.js';

export const examTests = [
  {
    id: 'exam.read.dashboard',
    module: 'exam',
    op: 'R',
    name: 'Load exam dashboard',
    screen: 'exam-dashboard',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get('/api/exam/dashboard');
      assertOk(res, 'exam dashboard');
    },
  },
  ...setupLoadTests({ module: 'exam', basePath: '/api/exam/setup', screens: EXAM_SETUP }),
  {
    id: 'exam.update.examiner-setup',
    module: 'exam',
    op: 'U',
    name: 'Save examiner setup (first batch type)',
    screen: 'examiner-setup',
    mutation: true,
    async run(ctx) {
      await ctx.client.login();

      const initial = await ctx.post('/api/exam/setup/examiner-setup/load', { fields: {} });
      assertOk(initial, 'load examiner setup');
      const courseKey = initial.data?.courseOptions?.[0]?.value;
      if (!courseKey) {
        throw new Error('No course options — configure courses first');
      }

      const withCourse = await ctx.post('/api/exam/setup/examiner-setup/load', {
        fields: { course_name: courseKey },
      });
      assertOk(withCourse, 'load with course');
      const semester = withCourse.data?.semesterOptions?.[0]?.value
        || withCourse.data?.semester
        || 1;

      const load = await ctx.post('/api/exam/setup/examiner-setup/load', {
        fields: { course_name: courseKey, semester_name: semester },
      });
      assertOk(load, 'load with course and semester');

      const data = load.data;
      const rows = data?.rows || [];
      const totalBatch = Number(data?.totalBatch) || 0;
      if (!rows.length) {
        throw new Error('No examiner types in cia_att_examiners_type');
      }
      if (!totalBatch) {
        throw new Error('No exam batches configured — run Exam Batch setup first');
      }

      const firstType = rows[0].examinerType;
      const save = await ctx.post('/api/exam/setup/examiner-setup/save', {
        fields: {
          courseKey,
          semester: Number(semester),
          totalBatch,
          rows: rows.map((row, index) => ({
            examinerType: row.examinerType,
            selectedBatch: index === 0 ? 1 : null,
          })),
        },
      });
      assertOk(save, 'save examiner setup');
      assert(save.data?.success !== false, 'save should succeed');
    },
  },
];
