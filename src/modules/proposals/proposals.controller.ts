import { Controller, Get, Post, Body, Param, Put, Delete, Res, Logger, Query } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { PdfService } from '../../common/pdf/pdf.service';
import { BranchesService } from '../branches/branches.service';
import { LoanTypesService } from '../loan-types/loan-types.service';
import { KredpoolService } from '../kredpool/kredpool.service';
import type { FastifyReply } from 'fastify';

@Controller('proposals')
export class ProposalsController {
  private readonly logger = new Logger(ProposalsController.name);

  constructor(
    private readonly proposalsService: ProposalsService,
    private readonly pdfService: PdfService,
    private readonly branchesService: BranchesService,
    private readonly loanTypesService: LoanTypesService,
    private readonly kredpoolService: KredpoolService
  ) { }

  @Get()
  async getProposals() {
    const data = await this.proposalsService.findAll();
    return { data };
  }

  @Post('verify-pan')
  async verifyPan(@Body('pan_no') panNo: string) {
    const result = await this.kredpoolService.verifyPan(panNo);
    return result;
  }

  @Post('verify-aadhaar-otp')
  async verifyAadhaarOtp(@Body('aadhaar_no') aadhaarNo: string) {
    const result = await this.kredpoolService.sendAadhaarOtp(aadhaarNo);
    return result;
  }

  @Post('verify-aadhaar-data')
  async verifyAadhaarData(
    @Body('client_id') clientId: string,
    @Body('otp') otp: string,
    @Body('aadhaar_no') aadhaarNo: string,
  ) {
    const result = await this.kredpoolService.verifyAadhaarData(clientId, otp, aadhaarNo);
    return result;
  }

  @Get('tabs/master')
  async getTabMaster() {
    const data = await this.proposalsService.getTabMaster();
    return { data };
  }

  @Get('branches')
  async getBranches() {
    const data = await this.branchesService.findAll();
    return { data };
  }

  @Get('loan-types')
  async getLoanTypes() {
    const data = await this.loanTypesService.findAll();
    return { data };
  }

  @Post()
  async createProposal(@Body() payload: any) {
    const data = await this.proposalsService.create(payload);
    return { data, message: 'Proposal created successfully' };
  }

  @Get(':id/personal-info')
  async getPersonalInfo(
    @Param('id') id: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.getPersonalInfo(id, entityType || 'B', participantId);
    return { data };
  }

  @Put(':id/personal-info')
  async updatePersonalInfo(
    @Param('id') id: string,
    @Body() payload: any,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.updatePersonalInfo(id, payload, entityType || 'B', participantId);
    return { data, message: 'Personal info updated successfully' };
  }

  @Get(':id/loan-info')
  async getLoanInfo(@Param('id') id: string) {
    const data = await this.proposalsService.getLoanInfo(id);
    return { data };
  }

  @Put(':id/loan-info')
  async updateLoanInfo(@Param('id') id: string, @Body() payload: any) {
    const data = await this.proposalsService.updateLoanInfo(id, payload);
    return { data, message: 'Loan info updated successfully' };
  }

  @Get(':id/bank-scheme')
  async getBankScheme(@Param('id') id: string) {
    const data = await this.proposalsService.getBankScheme(id);
    return { data };
  }

  @Put(':id/bank-scheme')
  async updateBankScheme(@Param('id') id: string, @Body() payload: any) {
    const data = await this.proposalsService.updateBankScheme(id, payload);
    return { data, message: 'Bank scheme MIS updated successfully' };
  }

  @Get(':id/financial-info')
  async getFinancialInfo(
    @Param('id') id: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.getFinancialInfo(id, entityType || 'B', participantId);
    return { data };
  }

  @Put(':id/financial-info')
  async updateFinancialInfo(
    @Param('id') id: string,
    @Body() payload: any,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.updateFinancialInfo(id, payload, entityType || 'B', participantId);
    return { data, message: 'Financial info updated successfully' };
  }

  @Get(':id/credit-info')
  async getCreditInfo(
    @Param('id') id: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.getCreditInfo(id, entityType || 'B', participantId);
    return { data };
  }

  @Put(':id/credit-info')
  async updateCreditInfo(
    @Param('id') id: string,
    @Body() payload: any,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.upsertCreditInfo(id, payload, entityType || 'B', participantId);
    return { data, message: 'Credit info updated successfully' };
  }

  @Get(':id/credit-loans-this-bank')
  async getCreditLoansThisBank(
    @Param('id') id: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.getCreditLoansThisBank(id, entityType || 'B', participantId);
    return { data };
  }

  @Put(':id/credit-loans-this-bank')
  async updateCreditLoanThisBank(
    @Param('id') id: string,
    @Body() payload: any,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.upsertCreditLoanThisBank(id, payload, entityType || 'B', participantId);
    return { data, message: 'Loan info updated successfully' };
  }

  @Delete('credit-loans/:id/this-bank')
  async deleteCreditLoanThisBank(@Param('id') id: string) {
    await this.proposalsService.deleteCreditLoanThisBank(id);
    return { message: 'Loan record deleted successfully' };
  }

  @Get(':id/credit-loans-other-banks')
  async getCreditLoansOtherBank(
    @Param('id') id: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.getCreditLoansOtherBank(id, entityType || 'B', participantId);
    return { data };
  }

  @Put(':id/credit-loans-other-banks')
  async updateCreditLoanOtherBank(
    @Param('id') id: string,
    @Body() payload: any,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.upsertCreditLoanOtherBank(id, payload, entityType || 'B', participantId);
    return { data, message: 'External loan info updated successfully' };
  }

  @Delete('credit-loans/:id/other-bank')
  async deleteCreditLoanOtherBank(@Param('id') id: string) {
    await this.proposalsService.deleteCreditLoanOtherBank(id);
    return { message: 'External loan record deleted successfully' };
  }

  @Get(':id/credit-guarantees-this-bank')
  async getCreditGuaranteesThisBank(
    @Param('id') id: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.getCreditGuaranteesThisBank(id, entityType || 'B', participantId);
    return { data };
  }

  @Put(':id/credit-guarantees-this-bank')
  async updateCreditGuaranteeThisBank(
    @Param('id') id: string,
    @Body() payload: any,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.upsertCreditGuaranteeThisBank(id, payload, entityType || 'B', participantId);
    return { data, message: 'Guarantee info updated successfully' };
  }

  @Delete('credit-guarantees/:id/this-bank')
  async deleteCreditGuaranteeThisBank(@Param('id') id: string) {
    await this.proposalsService.deleteCreditGuaranteeThisBank(id);
    return { message: 'Guarantee record deleted successfully' };
  }

  @Get(':id/credit-guarantees-other-banks')
  async getCreditGuaranteesOtherBank(
    @Param('id') id: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.getCreditGuaranteesOtherBank(id, entityType || 'B', participantId);
    return { data };
  }

  @Put(':id/credit-guarantees-other-banks')
  async updateCreditGuaranteeOtherBank(
    @Param('id') id: string,
    @Body() payload: any,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.upsertCreditGuaranteeOtherBank(id, payload, entityType || 'B', participantId);
    return { data, message: 'External guarantee info updated successfully' };
  }

  @Delete('credit-guarantees/:id/other-bank')
  async deleteCreditGuaranteeOtherBank(@Param('id') id: string) {
    await this.proposalsService.deleteCreditGuaranteeOtherBank(id);
    return { message: 'External guarantee record deleted successfully' };
  }

  @Get(':id/previous-loans-this-bank')
  async getPreviousLoansThisBank(
    @Param('id') id: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.getPreviousLoansThisBank(id, entityType || 'B', participantId);
    return { data };
  }

  @Put(':id/previous-loans-this-bank')
  async updatePreviousLoanThisBank(
    @Param('id') id: string,
    @Body() payload: any,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.upsertPreviousLoanThisBank(id, payload, entityType || 'B', participantId);
    return { data, message: 'Historical loan info updated successfully' };
  }

  @Delete('previous-loans/:id/this-bank')
  async deletePreviousLoanThisBank(@Param('id') id: string) {
    await this.proposalsService.deletePreviousLoanThisBank(id);
    return { message: 'Historical loan record deleted successfully' };
  }

  @Get(':id/previous-loans-other-banks')
  async getPreviousLoansOtherBank(
    @Param('id') id: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.getPreviousLoansOtherBank(id, entityType || 'B', participantId);
    return { data };
  }

  @Put(':id/previous-loans-other-banks')
  async updatePreviousLoanOtherBank(
    @Param('id') id: string,
    @Body() payload: any,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.upsertPreviousLoanOtherBank(id, payload, entityType || 'B', participantId);
    return { data, message: 'External historical loan info updated successfully' };
  }

  @Delete('previous-loans/:id/other-bank')
  async deletePreviousLoanOtherBank(@Param('id') id: string) {
    await this.proposalsService.deletePreviousLoanOtherBank(id);
    return { message: 'External historical loan record deleted successfully' };
  }

  @Get(':id/accounts-this-bank')
  async getAccountsThisBank(
    @Param('id') id: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.getAccountsThisBank(id, entityType || 'B', participantId);
    return { data };
  }

  @Put(':id/accounts-this-bank')
  async updateAccountThisBank(
    @Param('id') id: string,
    @Body() payload: any,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.upsertAccountThisBank(id, payload, entityType || 'B', participantId);
    return { data, message: 'Account info updated successfully' };
  }

  @Delete('accounts/:id/this-bank')
  async deleteAccountThisBank(@Param('id') id: string) {
    await this.proposalsService.deleteAccountThisBank(id);
    return { message: 'Account record deleted successfully' };
  }

  @Get(':id/accounts-other-banks')
  async getAccountsOtherBank(
    @Param('id') id: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.getAccountsOtherBank(id, entityType || 'B', participantId);
    return { data };
  }

  @Put(':id/accounts-other-banks')
  async updateAccountOtherBank(
    @Param('id') id: string,
    @Body() payload: any,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.upsertAccountOtherBank(id, payload, entityType || 'B', participantId);
    return { data, message: 'External account info updated successfully' };
  }

  @Delete('accounts/:id/other-bank')
  async deleteAccountOtherBank(@Param('id') id: string) {
    await this.proposalsService.deleteAccountOtherBank(id);
    return { message: 'External account record deleted successfully' };
  }

  @Get(':id/life-insurances')
  async getLifeInsurances(
    @Param('id') id: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.getLifeInsurances(id, entityType || 'B', participantId);
    return { data };
  }

  @Put(':id/life-insurances')
  async updateLifeInsurance(
    @Param('id') id: string,
    @Body() payload: any,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.upsertLifeInsurance(id, payload, entityType || 'B', participantId);
    return { data, message: 'Life insurance info updated successfully' };
  }

  @Delete('life-insurance/:id')
  async deleteLifeInsurance(@Param('id') id: string) {
    await this.proposalsService.deleteLifeInsurance(id);
    return { message: 'Life insurance record deleted successfully' };
  }

  @Get(':id/new-insurances')
  async getNewInsurances(
    @Param('id') id: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.getNewInsurances(id, entityType || 'B', participantId);
    return { data };
  }

  @Put(':id/new-insurances')
  async updateNewInsurance(
    @Param('id') id: string,
    @Body() payload: any,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.upsertNewInsurance(id, payload, entityType || 'B', participantId);
    return { data, message: 'New insurance info updated successfully' };
  }

  @Delete('new-insurance/:id')
  async deleteNewInsurance(@Param('id') id: string) {
    await this.proposalsService.deleteNewInsurance(id);
    return { message: 'New insurance record deleted successfully' };
  }

  @Get(':id/roc-debts')
  async getRocDebts(
    @Param('id') id: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.getRocDebts(id, entityType || 'B', participantId);
    return { data };
  }

  @Put(':id/roc-debts')
  async updateRocDebt(
    @Param('id') id: string,
    @Body() payload: any,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.upsertRocDebt(id, payload, entityType || 'B', participantId);
    return { data, message: 'ROC debt record updated successfully' };
  }

  @Delete('roc-debt/:id')
  async deleteRocDebt(@Param('id') id: string) {
    await this.proposalsService.deleteRocDebt(id);
    return { message: 'ROC debt record deleted successfully' };
  }

  @Get(':id/incomes')
  async getIncomes(
    @Param('id') id: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.getIncomes(id, entityType || 'B', participantId);
    return { data };
  }

  @Put(':id/incomes/:category')
  async updateIncome(
    @Param('id') id: string,
    @Param('category') category: string,
    @Body() payload: any,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.updateIncome(id, category, payload, entityType || 'B', participantId);
    return { data, message: `${category} income updated successfully` };
  }

  @Delete('incomes/:id/:category')
  async deleteIncome(
    @Param('id') id: string,
    @Param('category') category: string
  ) {
    await this.proposalsService.deleteIncome(id, category);
    return { message: 'Income record deleted successfully' };
  }

  @Get(':id/tabs')
  async getProposalTabs(
    @Param('id') id: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.getProposalTabs(id, entityType || 'B', participantId);
    return { data };
  }

  @Post(':id/tabs/mapping')
  async updateProposalTabsMapping(@Param('id') id: string, @Body('tabKeys') tabKeys: string[]) {
    const data = await this.proposalsService.updateProposalTabsMapping(id, tabKeys);
    return { data, message: 'Proposal tab mapping updated successfully' };
  }

  @Get(':id/properties')
  async getProperties(
    @Param('id') id: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.getProperties(id, entityType || 'B', participantId);
    return { data };
  }

  @Put(':id/properties')
  async updateProperty(
    @Param('id') id: string,
    @Body() payload: any,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.proposalsService.updateProperty(id, payload, entityType || 'B', participantId);
    return { data, message: 'Property info updated successfully' };
  }

  @Post('properties/delete')
  async deleteProperty(@Body('propertyId') propertyId: string) {
    await this.proposalsService.deleteProperty(propertyId);
    return { message: 'Property deleted successfully' };
  }

  @Get(':id/machinery-info')
  async getMachineryInfo(@Param('id') id: string) {
    const data = await this.proposalsService.getMachineryInfo(id);
    return { data };
  }

  @Get(':id/higher-purchase-data')
  async getHigherPurchaseData(@Param('id') id: string) {
    const data = await this.proposalsService.getHigherPurchaseData(id);
    return { data };
  }

  @Put(':id/higher-purchase-data')
  async updateHigherPurchaseData(@Param('id') id: string, @Body() payload: any) {
    const data = await this.proposalsService.updateHigherPurchaseData(id, payload);
    return { data, message: 'Higher purchase settings updated successfully' };
  }

  @Get('loan-application-data/:id')
  async getloanApplicationData(@Param('id') id: string) {
    const data = await this.proposalsService.getloanApplicationData(id);
    return { data };
  }

  @Get('loan-scrutiny-data/:id')
  async getloanScrutinyData(@Param('id') id: string) {
    const data = await this.proposalsService.getloanScrutinyData(id);
    return { data };
  } 

   @Get('loan-gaurantor-data/:id')
  async getGaurantorData(@Param('id') id: string) {
    const data = await this.proposalsService.getGaurantorData(id);
    return { data };
  } 

  @Put(':id/machinery-item')
  async upsertMachineryItem(@Param('id') id: string, @Body() payload: any) {
    const data = await this.proposalsService.upsertMachineryItem(id, payload);
    return { data, message: 'Machinery item updated successfully' };
  }

  @Delete('machinery/:id')
  async deleteMachineryItem(@Param('id') id: string) {
    await this.proposalsService.deleteMachineryItem(id);
    return { message: 'Machinery item deleted successfully' };
  }

  @Get(':id/print/branch-report')
  async generateBranchReport(@Param('id') id: string, @Res() res: FastifyReply) {
    this.logger.log(`Generating report for proposal: ${id}`);
    try {
      const data = await this.proposalsService.getBranchReportData(id);
      this.logger.log(`Report data for ${id} fetched successfully`);
      
      const pdfBuffer = await this.pdfService.generatePdf('branch-report', data);
      this.logger.log(`PDF for ${id} generated successfully. Size: ${pdfBuffer.length} bytes`);

      res.headers({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=Branch_Report_${id}.pdf`,
        'Content-Length': pdfBuffer.length.toString(),
      });

      res.send(pdfBuffer);
    } catch (error) {
      this.logger.error(`Failed to generate report for ${id}: ${error.message}`, error.stack);
      res.status(500).send({
        statusCode: 500,
        message: 'Internal Server Error while generating PDF',
        error: error.message
      });
    }
  }

  @Post(':id/submit')
  async submitProposal(@Param('id') id: string, @Body('remarks') remarks: string) {
    const data = await this.proposalsService.submitProposal(id, remarks);
    return { data, message: 'Proposal submitted successfully' };
  }

  @Post(':id/tabs/mark-filled')
  async markTabAsFilled(
    @Param('id') id: string, 
    @Body('tabKey') tabKey: string,
    @Body('entityType') entityType?: string,
    @Body('participantId') participantId?: string
  ) {
    await this.proposalsService.markTabAsFilled(id, tabKey, entityType || 'B', participantId);
    return { message: 'Tab marked as filled' };
  }
}
