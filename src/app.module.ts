import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './core/database/database.module';
import { IdModule } from './core/id/id.module';
import { EmailModule } from './core/email/email.module';
import { EmployeesModule } from './modules/admin/employee-master/employees.module';
import { PasswordPolicyModule } from './modules/admin/password-policy/password-policy.module';
import { AuditUnitsModule } from './modules/admin/audit-unit-master/audit-units.module';
import { AuditSectionsModule } from './modules/admin/audit-section-master/audit-sections.module';
import { MenuMasterModule } from './modules/admin/menu-master/menu-master.module';
import { AuditSchemesModule } from './modules/admin/audit-scheme-master/audit-schemes.module';
import { AuditQuestionsModule } from './modules/admin/audit-question-master/audit-questions.module';
import { BroaderAreaMasterModule } from './modules/admin/broader-area-master/broader-area-master.module';
import { ManageAssementMasterModule } from './modules/admin/manage-assement-master/manage-assement-master.module';
import { AuditCategoriesModule } from './modules/admin/audit-category-master/audit-categories.module';
import { AuditAnnexureModule } from './modules/admin/audit-annexure-master/audit-annexure.module';
import { RiskCategoryModule } from './modules/admin/risk-masters/risk-category/risk-category.module';
import { RiskControlModule } from './modules/admin/risk-masters/risk-control/risk-control.module';
import { RiskCompositeModule } from './modules/admin/risk-masters/risk-composite/risk-composite.module';
import { RiskMatrixModule } from './modules/admin/risk-masters/risk-matrix/risk-matrix.module';
import { BranchRatingModule } from './modules/admin/risk-masters/risk-branch-rating/risk-branch-rating.module';
import { PeriodwiseQuestionsMasterModule } from './modules/admin/periodwise-questions-master/periodwise-questions-master.module';
import { AuditDashboardModule } from './modules/auditor/audit-dashboard/audit-dashboard.module';
import { InternalAuditModule } from './modules/auditor/internal-audit/internal-audit.module';
import { DepositAccountsModule } from './modules/admin/manage-accounts/deposit-accounts/deposit-accounts.module';
import { AdvanceAccountsModule } from './modules/admin/manage-accounts/advance-accounts/advance-accounts.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PolicyDocumentsModule } from './modules/admin/policy-documents/policy-documents.module';
import { AuditCalendarModule } from './modules/admin/audit-calendar/audit-calendar.module';
import { RegionMasterModule } from './modules/admin/region-master/region-master.module';
import { SpecialAuditModule } from './modules/admin/special-audit/special-audit.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { MasterBulkUploadModule } from './modules/admin/master-bulk-upload/master-bulk-upload.module';
import { AuditTypeModule } from './modules/admin/audit-type-master/audit-type.module';
import { IncidentManagementModule } from './modules/incident-management/incident-management.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    IdModule,
    EmailModule,
    EmployeesModule,
    PasswordPolicyModule,
    AuditSectionsModule,
    MenuMasterModule,
    AuditUnitsModule,
    AuditSchemesModule,
    AuditQuestionsModule,
    BroaderAreaMasterModule,
    ManageAssementMasterModule,
    AuditCategoriesModule,
    AuditAnnexureModule,
    RiskCategoryModule,
    RiskControlModule,
    RiskCompositeModule,
    RiskMatrixModule,
    BranchRatingModule,
    BranchRatingModule,
    PeriodwiseQuestionsMasterModule,
    AuditDashboardModule,
    InternalAuditModule,
    DepositAccountsModule,
    AdvanceAccountsModule,
    UsersModule,
    AuthModule,
    ReportsModule,
    PolicyDocumentsModule,
    AuditCalendarModule,
    RegionMasterModule,
    SpecialAuditModule,
    AuditLogsModule,
    MasterBulkUploadModule,
    AuditTypeModule,
    IncidentManagementModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

