-- Create trigger function for answers_data to log to answers_data_timeline
CREATE OR REPLACE FUNCTION public.log_answers_data_to_timeline()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if it is an INSERT, or an UPDATE where key fields have changed
    IF (TG_OP = 'UPDATE') THEN
        IF (
            COALESCE(NEW.answer_given, '') = COALESCE(OLD.answer_given, '') AND
            COALESCE(NEW.audit_comment, '') = COALESCE(OLD.audit_comment, '') AND
            COALESCE(NEW.audit_reviewer_comment, '') = COALESCE(OLD.audit_reviewer_comment, '') AND
            COALESCE(NEW.audit_commpliance, '') = COALESCE(OLD.audit_commpliance, '') AND
            COALESCE(NEW.compliance_reviewer_comment, '') = COALESCE(OLD.compliance_reviewer_comment, '') AND
            COALESCE(NEW.audit_status_id, 0) = COALESCE(OLD.audit_status_id, 0) AND
            COALESCE(NEW.compliance_status_id, 0) = COALESCE(OLD.compliance_status_id, 0) AND
            COALESCE(NEW.audit_evidance_upload, '') = COALESCE(OLD.audit_evidance_upload, '') AND
            COALESCE(NEW.compliance_evidance_upload, '') = COALESCE(OLD.compliance_evidance_upload, '')
        ) THEN
            RETURN NEW;
        END IF;
    END IF;

    INSERT INTO public.answers_data_timeline (
        answer_id,
        annex_id,
        assesment_id,
        answer_given,
        audit_comment,
        audit_emp_id,
        audit_status_id,
        audit_reviewer_emp_id,
        audit_reviewer_comment,
        audit_commpliance,
        audit_evidance_upload,
        audit_compulsary_ev_upload,
        compliance_evidance_upload,
        compliance_compulsary_ev_upload,
        compliance_emp_id,
        compliance_status_id,
        compliance_reviewer_emp_id,
        compliance_reviewer_comment,
        business_risk,
        control_risk,
        batch_key,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        0,
        NEW.assesment_id,
        NEW.answer_given,
        NEW.audit_comment,
        NEW.audit_emp_id,
        NEW.audit_status_id,
        NEW.audit_reviewer_emp_id,
        NEW.audit_reviewer_comment,
        NEW.audit_commpliance,
        NEW.audit_evidance_upload,
        NEW.audit_compulsary_ev_upload,
        NEW.compliance_evidance_upload,
        NEW.compliance_compulsary_ev_upload,
        NEW.compliance_emp_id,
        NEW.compliance_status_id,
        NEW.compliance_reviewer_emp_id,
        NEW.compliance_reviewer_comment,
        NEW.business_risk,
        NEW.control_risk,
        NEW.batch_key,
        NOW(),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for answers_data_annexure to log to answers_data_timeline
CREATE OR REPLACE FUNCTION public.log_answers_data_annexure_to_timeline()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if it is an INSERT, or an UPDATE where key fields have changed
    IF (TG_OP = 'UPDATE') THEN
        IF (
            COALESCE(NEW.answer_given, '') = COALESCE(OLD.answer_given, '') AND
            COALESCE(NEW.audit_comment, '') = COALESCE(OLD.audit_comment, '') AND
            COALESCE(NEW.audit_reviewer_comment, '') = COALESCE(OLD.audit_reviewer_comment, '') AND
            COALESCE(NEW.audit_commpliance, '') = COALESCE(OLD.audit_commpliance, '') AND
            COALESCE(NEW.compliance_reviewer_comment, '') = COALESCE(OLD.compliance_reviewer_comment, '') AND
            COALESCE(NEW.audit_status_id, 0) = COALESCE(OLD.audit_status_id, 0) AND
            COALESCE(NEW.compliance_status_id, 0) = COALESCE(OLD.compliance_status_id, 0) AND
            COALESCE(NEW.audit_evidance_upload, '') = COALESCE(OLD.audit_evidance_upload, '') AND
            COALESCE(NEW.compliance_evidance_upload, '') = COALESCE(OLD.compliance_evidance_upload, '') AND
            COALESCE(NEW.risk_cat_id, 0) = COALESCE(OLD.risk_cat_id, 0)
        ) THEN
            RETURN NEW;
        END IF;
    END IF;

    INSERT INTO public.answers_data_timeline (
        answer_id,
        annex_id,
        assesment_id,
        answer_given,
        audit_comment,
        audit_emp_id,
        audit_status_id,
        audit_reviewer_emp_id,
        audit_reviewer_comment,
        audit_commpliance,
        audit_evidance_upload,
        audit_compulsary_ev_upload,
        compliance_evidance_upload,
        compliance_compulsary_ev_upload,
        compliance_emp_id,
        compliance_status_id,
        compliance_reviewer_emp_id,
        compliance_reviewer_comment,
        business_risk,
        control_risk,
        risk_cat_id,
        batch_key,
        created_at,
        updated_at
    ) VALUES (
        NEW.answer_id,
        NEW.id,
        NEW.assesment_id,
        NEW.answer_given,
        NEW.audit_comment,
        NEW.audit_emp_id,
        NEW.audit_status_id,
        NEW.audit_reviewer_emp_id,
        NEW.audit_reviewer_comment,
        NEW.audit_commpliance,
        NEW.audit_evidance_upload,
        NEW.audit_compulsary_ev_upload,
        NEW.compliance_evidance_upload,
        NEW.compliance_compulsary_ev_upload,
        NEW.compliance_emp_id,
        NEW.compliance_status_id,
        NEW.compliance_reviewer_emp_id,
        NEW.compliance_reviewer_comment,
        NEW.business_risk,
        NEW.control_risk,
        NEW.risk_cat_id,
        NEW.batch_key,
        NOW(),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS trg_answers_data_timeline ON public.answers_data;
CREATE TRIGGER trg_answers_data_timeline
AFTER INSERT OR UPDATE ON public.answers_data
FOR EACH ROW
EXECUTE FUNCTION public.log_answers_data_to_timeline();

DROP TRIGGER IF EXISTS trg_answers_data_annexure_timeline ON public.answers_data_annexure;
CREATE TRIGGER trg_answers_data_annexure_timeline
AFTER INSERT OR UPDATE ON public.answers_data_annexure
FOR EACH ROW
EXECUTE FUNCTION public.log_answers_data_annexure_to_timeline();
