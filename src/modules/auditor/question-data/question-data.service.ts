import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { DatabaseService }
    from '../../../core/database/database.service';

@Injectable()
export class QuestionDataService {

    constructor(
        private readonly db: DatabaseService,
    ) { }

    async getQuestionData(
        assessment_id: number,
        language_id?: number,
    ) {

        const result = await this.db.query(

            `

            SELECT

                mm.id AS menu_id,
                mm.name AS menu_name,

                cm.id AS category_id,
                cm.name AS category_name,

                qsm.id AS question_set_id,
                qsm.name AS question_set_name,

                qhm.id AS header_id,
                qhm.name AS header_name,

                q.questions

            FROM audit_assesment_master mlcm

            JOIN menu_master mm
                ON mm.id = ANY(
                    string_to_array(
                        mlcm.menu_ids,
                        ','
                    )::int[]
                )

            JOIN category_master cm
                ON cm.menu_id = mm.id
               AND cm.id = ANY(
                    string_to_array(
                        mlcm.cat_ids,
                        ','
                    )::int[]
               )

            JOIN question_set_master qsm
                ON qsm.id = ANY(
                    string_to_array(
                        cm.question_set_ids,
                        ','
                    )::int[]
                )

            JOIN question_header_master qhm
                ON qhm.question_set_id = qsm.id

            LEFT JOIN
            (

                SELECT

                    qm.header_id,
                    qm.set_id,

                    json_agg(

                        json_build_object(

                            'question_id', qm.id,
                            'question', CASE 
                                WHEN (SELECT code FROM language_master WHERE id = $2) = 'mr' 
                                THEN COALESCE(qm.mr_question, qm.question)
                                ELSE qm.question 
                            END,
                            'question_type_id', qm.question_type_id,
                            'option_id', qm.option_id,

                            'parameters',

                            CASE
                                WHEN qm.parameters IS NULL
                                     OR qm.parameters = ''
                                THEN '[]'::json
                                ELSE qm.parameters::json
                            END,

                            'suggestions',
                            CASE 
                                WHEN (SELECT code FROM language_master WHERE id = $2) = 'mr' 
                                THEN COALESCE(qm.mr_suggestions, qm.suggestions)
                                ELSE qm.suggestions 
                            END,

                            'risk_category_id', qm.risk_category_id,
                            'annexure_id', qm.annexure_id,
                            'area_of_audit_id', qm.area_of_audit_id,
                            'applicable_id', qm.applicable_id,
                            'control_risk_id', qm.control_risk_id,
                            'key_aspect_id', qm.key_aspect_id,
                            'residual_risk_id', qm.residual_risk_id,
                            'show_instances', qm.show_instances,
                            'audit_ev_upload', qm.audit_ev_upload,
                            'compliance_ev_upload', qm.compliance_ev_upload,

                            'annexure',

                            json_build_object(

                                'annexure_id', am.id,
                                'annexure_name', am.name,

                                'columns',

                                COALESCE(
                                    ac.columns_json,
                                    '[]'::json
                                )

                            )

                        )

                    ) AS questions

                FROM question_master qm

                LEFT JOIN annexure_master am
                    ON am.id = qm.annexure_id

                LEFT JOIN
                (

                    SELECT

                        ac.annexure_id,

                        json_agg(

                            json_build_object(

                                'column_name', ac.name,
                                'column_type_id', ac.column_type_id,
                                'column_options', ac.column_options

                            )

                        ) AS columns_json

                    FROM annexure_columns ac

                    WHERE ac.deleted_at IS NULL

                    GROUP BY ac.annexure_id

                ) ac
                    ON ac.annexure_id = am.id

                WHERE
                    qm.deleted_at IS NULL
                    AND qm.is_active = 1

                GROUP BY
                    qm.header_id,
                    qm.set_id

            ) q
                ON q.header_id = qhm.id
               AND q.set_id = qsm.id

            WHERE
                mlcm.id = $1
                AND mlcm.deleted_at IS NULL

            ORDER BY
                mm.id,
                cm.id,
                qsm.id,
                qhm.id

            `,

            [assessment_id, language_id || null],

        );

        const rows = result.rows;
        for (const row of rows) {
          if (row.questions && Array.isArray(row.questions)) {
            for (const q of row.questions) {
              if (q.suggestions) {
                q.suggestions = this.normalizeSuggestions(q.suggestions);
              }
            }
          }
        }

        return rows;

    }

    private normalizeSuggestions(suggestionsStr: string): string | null {
      if (!suggestionsStr) return null;
      try {
        const parsed = this.repairJson(suggestionsStr);
        if (!parsed) return suggestionsStr;
        
        let langKey = 'english';
        if (parsed.marathi) {
          langKey = 'marathi';
        } else if (parsed.english) {
          langKey = 'english';
        } else {
          const opts = parsed.suggestions || parsed.options || [];
          return JSON.stringify({
            default: parsed.default || '',
            suggestions: Array.isArray(opts) ? opts : []
          });
        }
        
        const langData = parsed[langKey] || {};
        const opts = langData.suggestions || langData.options || [];
        return JSON.stringify({
          default: langData.default || '',
          suggestions: Array.isArray(opts) ? opts : []
        });
      } catch (e) {
        return suggestionsStr;
      }
    }

    private repairJson(jsonStr: string): any {
      if (!jsonStr) return null;
      let cleanStr = jsonStr.trim();
      
      try {
        return JSON.parse(cleanStr);
      } catch (e) {
        // repair
      }

      let hasOpenQuote = false;
      let bracketStack: string[] = [];
      
      let i = 0;
      let repaired = '';
      while (i < cleanStr.length) {
        const char = cleanStr[i];
        if (char === '\\' && i + 1 < cleanStr.length) {
          repaired += cleanStr.substring(i, i + 2);
          i += 2;
          continue;
        }
        if (char === '"') {
          hasOpenQuote = !hasOpenQuote;
        }
        if (!hasOpenQuote) {
          if (char === '{' || char === '[') {
            bracketStack.push(char === '{' ? '}' : ']');
          } else if (char === '}' || char === ']') {
            if (bracketStack.length > 0 && bracketStack[bracketStack.length - 1] === char) {
              bracketStack.pop();
            }
          }
        }
        repaired += char;
        i++;
      }
      
      if (hasOpenQuote) {
        repaired += '"';
      }
      while (bracketStack.length > 0) {
        repaired += bracketStack.pop();
      }
      
      try {
        return JSON.parse(repaired);
      } catch (err) {
        const matchDefault = jsonStr.match(/"default"\s*:\s*"([^"]*)/);
        if (matchDefault) {
          return {
            default: matchDefault[1],
            suggestions: []
          };
        }
        return null;
      }
    }

}